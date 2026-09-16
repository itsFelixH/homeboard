/**
 * Commute module - shows transit + bike time to multiple work locations
 * - Morning Schedule Aware:
 *   - Current day before 09:30 AM (or targetArrivalToday): shows route arriving <= 09:30 AM
 *   - After 09:30 AM or on weekends: shows next workday (tomorrow or Monday) departing >= 06:00 AM (or targetDepartureNextDay)
 * - Transit: VBB HAFAS API (primary) or Transitous (fallback)
 * - Bike: OSRM speed-based route calculation with schedule times
 */
const Commute = (() => {
  let refreshInterval;
  let cachedResults = [];

  function init() {
    const config = HOMEBOARD_CONFIG.commute;
    if (!config || !config.destinations || config.destinations.length === 0) {
      const el = document.getElementById('commute-list');
      if (el) el.innerHTML = '<div class="commute-empty">Set destinations in config</div>';
      return;
    }
    fetchAll();
    refreshInterval = setInterval(fetchAll, (config.refreshMinutes || 10) * 60 * 1000);
  }

  function getTargetSchedule(config) {
    const now = new Date();
    const targetArrivalToday = config.targetArrivalToday || '09:30';
    const targetDepartureNextDay = config.targetDepartureNextDay || '06:00';
    const skipWeekends = config.skipWeekends !== false;

    const [arrH, arrM] = targetArrivalToday.split(':').map(Number);
    const todayCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), arrH, arrM, 0, 0);

    const dow = now.getDay(); // 0=Sun, 6=Sat
    const isWeekday = dow >= 1 && dow <= 5;
    const isBeforeTodayCutoff = isWeekday && (now < todayCutoff);

    const lang = (window.Lang && typeof window.Lang.get === 'function') ? window.Lang.get() : 'de';

    if (isBeforeTodayCutoff) {
      return {
        targetDate: now,
        targetTime: targetArrivalToday,
        isArrival: true,
        dayLabel: lang === 'de' ? 'Heute' : 'Today',
        scheduleLabel: lang === 'de' ? `Ankunft ≤ ${targetArrivalToday}` : `Arrive ≤ ${targetArrivalToday}`,
        badgeText: lang === 'de' ? `Heute · Ankunft ≤ ${targetArrivalToday}` : `Today · Arrive ≤ ${targetArrivalToday}`
      };
    }

    // Determine next workday
    let daysToAdd = 1;
    if (skipWeekends) {
      if (dow === 5) daysToAdd = 3; // Fri -> Mon
      else if (dow === 6) daysToAdd = 2; // Sat -> Mon
      else if (dow === 0) daysToAdd = 1; // Sun -> Mon
    }

    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd, 6, 0, 0, 0);
    const nextDow = nextDate.getDay();
    const dayNamesShort = lang === 'de'
      ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let dayLabel;
    if (daysToAdd === 1 && (dow >= 1 && dow <= 4)) {
      dayLabel = lang === 'de' ? 'Morgen' : 'Tomorrow';
    } else {
      dayLabel = dayNamesShort[nextDow];
    }

    return {
      targetDate: nextDate,
      targetTime: targetDepartureNextDay,
      isArrival: false,
      dayLabel,
      scheduleLabel: lang === 'de' ? `Abfahrt ab ${targetDepartureNextDay}` : `Depart from ${targetDepartureNextDay}`,
      badgeText: `${dayLabel} · ${lang === 'de' ? `Abfahrt ab ${targetDepartureNextDay}` : `Depart from ${targetDepartureNextDay}`}`
    };
  }

  async function fetchAll() {
    const config = HOMEBOARD_CONFIG.commute;
    if (!config || !config.destinations) return;

    const origin = config.origin?.latitude && config.origin?.longitude
      ? config.origin
      : HOMEBOARD_CONFIG.location;

    const schedule = getTargetSchedule(config);

    cachedResults = await Promise.all(
      config.destinations.map(dest => fetchRoute(origin, dest, schedule))
    );
    render(schedule);
  }

  async function fetchRoute(origin, dest, schedule) {
    const result = {
      label: dest.label,
      transit: null,
      transitLegs: [],
      transitDep: null,
      transitArr: null,
      bike: null,
      bikeKm: null,
      bikeDep: null,
      bikeArr: null
    };

    const dateStr = `${schedule.targetDate.getFullYear()}-${String(schedule.targetDate.getMonth()+1).padStart(2,'0')}-${String(schedule.targetDate.getDate()).padStart(2,'0')}`;
    const timeStr = schedule.targetTime;

    // Transit via HAFAS
    const hafasKey = HOMEBOARD_CONFIG.departures?.hafasAccessId;
    if (hafasKey) {
      try {
        const url = `https://vbb.demo.hafas.cloud/api/fahrinfo/latest/trip?` +
          `accessId=${hafasKey}` +
          `&originCoordLat=${origin.latitude}&originCoordLong=${origin.longitude}` +
          `&destCoordLat=${dest.latitude}&destCoordLong=${dest.longitude}` +
          `&format=json&numF=1` +
          `&date=${dateStr}&time=${timeStr}` +
          `&searchForArrival=${schedule.isArrival ? 1 : 0}`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const trips = data.Trip || [];
          if (trips.length > 0) {
            const trip = trips[0];
            result.transit = parsePTDuration(trip.duration);
            const rawDep = trip.Origin?.rtTime || trip.Origin?.time || '';
            const rawArr = trip.Destination?.rtTime || trip.Destination?.time || '';
            result.transitDep = rawDep.slice(0, 5);
            result.transitArr = rawArr.slice(0, 5);

            let legs = trip.LegList?.Leg || [];
            if (!Array.isArray(legs)) legs = [legs];
            result.transitLegs = legs.map(leg => {
              const name = (leg.name || '').trim();
              const from = (leg.Origin?.name || '').replace(' (Berlin)', '').replace(' Bhf', '');
              const to = (leg.Destination?.name || '').replace(' (Berlin)', '').replace(' Bhf', '');
              const dur = parsePTDuration(leg.duration);
              if (!name || name === 'Fußweg' || leg.type === 'WALK') {
                return { mode: 'WALK', duration: dur };
              }
              const icon = name.startsWith('U') ? '🚇' : name.startsWith('Bus') ? '🚌' : name.startsWith('S') ? '🚆' : '🚋';
              return { mode: 'TRANSIT', line: name, from, to, duration: dur, icon };
            });
          }
        }
      } catch (err) {
        console.error(`HAFAS trip failed for ${dest.label}:`, err);
      }
    }

    // Fallback to Transitous
    if (!result.transit) {
      try {
        const url = `https://api.transitous.org/api/v1/plan?` +
          `fromPlace=${origin.latitude},${origin.longitude}` +
          `&toPlace=${dest.latitude},${dest.longitude}` +
          `&mode=TRANSIT,WALK&numItineraries=1` +
          `&date=${dateStr}&time=${timeStr}` +
          `&arriveBy=${schedule.isArrival}`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.itineraries?.length > 0) {
            const it = data.itineraries[0];
            result.transit = Math.round(it.duration / 60);
            if (it.startTime) {
              const dt = new Date(it.startTime);
              result.transitDep = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
            }
            if (it.endTime) {
              const dt = new Date(it.endTime);
              result.transitArr = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
            }
            result.transitLegs = (it.legs || []).map(leg => {
              const dur = Math.round((leg.duration || 0) / 60);
              if (leg.mode === 'WALK') return { mode: 'WALK', duration: dur };
              const line = leg.route || leg.routeShortName || leg.mode;
              const from = (leg.from?.name || '').replace(' (Berlin)', '');
              const to = (leg.to?.name || '').replace(' (Berlin)', '');
              const icon = leg.mode === 'SUBWAY' ? '🚇' : leg.mode === 'BUS' ? '🚌' : '🚋';
              return { mode: 'TRANSIT', line, from, to, duration: dur, icon };
            });
          }
        }
      } catch (err) {
        console.error(`Transitous failed for ${dest.label}:`, err);
      }
    }

    // Bike calculation
    const bikeSpeedMpm = ((HOMEBOARD_CONFIG.commute && HOMEBOARD_CONFIG.commute.bikeSpeed) || 13) * 1000 / 60;
    try {
      const url = `https://router.project-osrm.org/route/v1/cycling/` +
        `${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes.length > 0) {
          const distM = data.routes[0].distance;
          const bikeMinutes = Math.round(distM / bikeSpeedMpm);
          result.bike = bikeMinutes;
          result.bikeKm = (distM / 1000).toFixed(1);

          // Calculate departure / arrival times based on schedule
          const [tH, tM] = schedule.targetTime.split(':').map(Number);
          if (schedule.isArrival) {
            const arrDate = new Date(schedule.targetDate.getFullYear(), schedule.targetDate.getMonth(), schedule.targetDate.getDate(), tH, tM, 0, 0);
            const depDate = new Date(arrDate.getTime() - bikeMinutes * 60000);
            result.bikeDep = `${String(depDate.getHours()).padStart(2,'0')}:${String(depDate.getMinutes()).padStart(2,'0')}`;
            result.bikeArr = schedule.targetTime;
          } else {
            const depDate = new Date(schedule.targetDate.getFullYear(), schedule.targetDate.getMonth(), schedule.targetDate.getDate(), tH, tM, 0, 0);
            const arrDate = new Date(depDate.getTime() + bikeMinutes * 60000);
            result.bikeDep = schedule.targetTime;
            result.bikeArr = `${String(arrDate.getHours()).padStart(2,'0')}:${String(arrDate.getMinutes()).padStart(2,'0')}`;
          }
        }
      }
    } catch (err) {
      console.error(`Bike fetch failed for ${dest.label}:`, err);
    }

    return result;
  }

  function parsePTDuration(str) {
    if (!str) return null;
    const h = str.match(/(\d+)H/);
    const m = str.match(/(\d+)M/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }

  function render(schedule) {
    if (cachedResults.length === 0) return;
    const container = document.getElementById('commute-list');
    if (!container) return;

    const navContainer = document.querySelector('.card-commute .commute-nav');
    if (navContainer) {
      navContainer.style.display = 'none';
    }

    const headerLabel = document.querySelector('.card-commute .card-header span[data-i18n="commute"]');
    if (headerLabel) {
      headerLabel.textContent = (window.i18n && typeof window.i18n === 'function') ? window.i18n('commute') : 'Arbeitsweg';
    }

    const sched = schedule || getTargetSchedule(HOMEBOARD_CONFIG.commute || {});
    let html = '';

    for (const r of cachedResults) {
      const labelLower = r.label.toLowerCase();
      const isDigitalCampus = labelLower.includes('digitalcampus');
      const isEuref = labelLower.includes('euref');

      let transitHtml = '';
      if (!isEuref && r.transit) {
        let legsHtml = '';
        if (r.transitLegs && r.transitLegs.length > 0) {
          const parts = r.transitLegs.map(leg => {
            if (leg.mode === 'WALK') return `<span class="commute-leg-walk">🚶${leg.duration} min</span>`;
            const fromLabel = leg.from ? `<span class="station-badge">${leg.from}</span>` : '';
            const toLabel = leg.to ? ` <span class="commute-leg-to">→</span> <span class="station-badge">${leg.to}</span>` : '';
            const style = window.getTransitLineStyle ? window.getTransitLineStyle(leg.line) : { bg: 'var(--surface-hover)', fg: 'var(--text)' };
            return `${fromLabel}<span class="transit-badge" style="background:${style.bg};color:${style.fg};border-color:${style.bg}">${leg.line}</span>${toLabel}`;
          });
          legsHtml = ` · ${parts.join('<span class="commute-leg-sep">·</span>')}`;
        }
        transitHtml = `<div class="commute-route-line">
          <span class="commute-route-left">🚋 <strong>${r.transit} min</strong>${legsHtml}</span>
          <span class="commute-route-right">${r.transitDep ? `Abf ${r.transitDep}` : ''}${r.transitArr ? ` · Ank ${r.transitArr}` : ''}</span>
        </div>`;
      }

      let bikeHtml = '';
      if (!isDigitalCampus && r.bike) {
        bikeHtml = `<div class="commute-route-line">
          <span class="commute-route-left">🚲 <strong>${r.bike} min</strong> · ${r.bikeKm || '--'} km</span>
          <span class="commute-route-right">${r.bikeDep ? `Abf ${r.bikeDep}` : ''}${r.bikeArr ? ` · Ank ${r.bikeArr}` : ''}</span>
        </div>`;
      }

      html += `<div class="commute-dest">
        <div class="commute-header-row">
          <span class="commute-dest-title">${r.label}</span>
          <span class="commute-schedule-badge">${sched.badgeText}</span>
        </div>
        ${transitHtml}
        ${bikeHtml}
      </div>`;
    }

    container.innerHTML = html;
  }

  return { init };
})();
