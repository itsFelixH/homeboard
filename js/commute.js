/**
 * Commute module - shows transit + bike time to multiple work locations
 * - Transit: VBB HAFAS API (primary) or Transitous (fallback)
 * - Bike: OSRM (× 1.5 correction)
 * - Interactive: click dots or card to cycle through destinations
 */
const Commute = (() => {
  let refreshInterval;
  let currentIndex = 0;
  let cachedResults = [];

  function init() {
    const config = HOMEBOARD_CONFIG.commute;
    if (!config.destinations || config.destinations.length === 0) {
      document.getElementById('commute-list').innerHTML =
        '<div class="commute-empty">Set destinations in config</div>';
      return;
    }
    fetchAll();
    refreshInterval = setInterval(fetchAll, config.refreshMinutes * 60 * 1000);
  }

  async function fetchAll() {
    const config = HOMEBOARD_CONFIG.commute;
    cachedResults = await Promise.all(
      config.destinations.map(dest => fetchRoute(config.origin, dest))
    );
    render();
  }

  async function fetchRoute(origin, dest) {
    const result = { label: dest.label, transit: null, transitLegs: [], bike: null, bikeKm: null };

    // Transit via HAFAS
    const hafasKey = HOMEBOARD_CONFIG.departures?.hafasAccessId;
    if (hafasKey) {
      try {
        const url = `https://vbb.demo.hafas.cloud/api/fahrinfo/latest/trip?` +
          `accessId=${hafasKey}` +
          `&originCoordLat=${origin.latitude}&originCoordLong=${origin.longitude}` +
          `&destCoordLat=${dest.latitude}&destCoordLong=${dest.longitude}` +
          `&format=json&numF=1`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const trips = data.Trip || [];
          if (trips.length > 0) {
            const trip = trips[0];
            result.transit = parsePTDuration(trip.duration);
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
              const icon = name.startsWith('U') ? '🚇' : name.startsWith('Bus') ? '🚌' : '🚋';
              return { mode: 'TRANSIT', line: name, from, to, duration: dur, icon };
            });
          }
        }
      } catch (err) {
        console.error(`HAFAS trip failed for ${dest.label}:`, err);
      }
    }

    // Fallback to Transitous if HAFAS didn't work
    if (!result.transit) {
      try {
        const url = `https://api.transitous.org/api/v1/plan?` +
          `fromPlace=${origin.latitude},${origin.longitude}` +
          `&toPlace=${dest.latitude},${dest.longitude}` +
          `&mode=TRANSIT,WALK&numItineraries=1`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.itineraries?.length > 0) {
            const it = data.itineraries[0];
            result.transit = Math.round(it.duration / 60);
            result.transitLegs = it.legs.map(leg => {
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

    // Bike via OSRM — calculate time from distance at configured speed
    const bikeSpeedMpm = ((HOMEBOARD_CONFIG.commute && HOMEBOARD_CONFIG.commute.bikeSpeed) || 13) * 1000 / 60;
    try {
      const url = `https://router.project-osrm.org/route/v1/cycling/` +
        `${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes.length > 0) {
          const distM = data.routes[0].distance;
          result.bike = Math.round(distM / bikeSpeedMpm);
          result.bikeKm = (distM / 1000).toFixed(1);
        }
      }
    } catch (err) {
      console.error(`Bike fetch failed for ${dest.label}:`, err);
    }

    return result;
  }

  function parsePTDuration(str) {
    if (!str) return null;
    // Format: PT39M or PT1H12M or PT2H
    const h = str.match(/(\d+)H/);
    const m = str.match(/(\d+)M/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }

  function switchTo(index) {
    currentIndex = index;
    render();
  }

  function render() {
    if (cachedResults.length === 0) return;
    const container = document.getElementById('commute-list');
    const r = cachedResults[currentIndex];

    // Update card header title
    const headerLabel = document.querySelector('.card-commute .card-header span[data-i18n="commute"]');
    if (headerLabel) headerLabel.textContent = r.label;

    // Arrow navigation in card header (same pattern as departures)
    let navContainer = document.querySelector('.card-commute .commute-nav');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.className = 'commute-nav';
      const header = document.querySelector('.card-commute .card-header');
      if (header) header.appendChild(navContainer);
    }
    if (cachedResults.length > 1) {
      const prevIdx = (currentIndex - 1 + cachedResults.length) % cachedResults.length;
      const nextIdx = (currentIndex + 1) % cachedResults.length;
      navContainer.innerHTML = `<div class="card-nav">
        <button class="card-nav-btn" onclick="Commute.switchTo(${prevIdx})" aria-label="Previous">‹</button>
        <span class="card-nav-label">${currentIndex + 1}/${cachedResults.length}</span>
        <button class="card-nav-btn" onclick="Commute.switchTo(${nextIdx})" aria-label="Next">›</button>
      </div>`;
    } else {
      navContainer.innerHTML = '';
    }

    // Calculate ETAs
    const now = new Date();
    const transitETA = r.transit ? formatETA(now, r.transit) : null;
    const bikeETA = r.bike ? formatETA(now, r.bike) : null;

    // Build route legs inline
    let legsHtml = '';
    if (r.transitLegs && r.transitLegs.length > 0) {
      const parts = r.transitLegs.map(leg => {
        if (leg.mode === 'WALK') return `<span class="commute-leg-walk">🚶${leg.duration} min</span>`;
        const fromLabel = leg.from ? `<span class="commute-leg-to">${leg.from}: </span>` : '';
        const toLabel = leg.to ? ` <span class="commute-leg-to">→ ${leg.to}</span>` : '';
        const style = window.getTransitLineStyle ? window.getTransitLineStyle(leg.line) : { bg: 'var(--surface-hover)', fg: 'var(--text)' };
        return `${fromLabel}<span class="transit-badge" style="background:${style.bg};color:${style.fg};border-color:${style.bg}">${leg.line}</span>${toLabel}`;
      });
      legsHtml = `<div class="commute-route">${parts.join('<span class="commute-leg-sep">·</span>')}</div>`;
    }

    // Transit section
    const showTransit = HOMEBOARD_CONFIG.commute.showTransit !== false;
    const transitSection = (showTransit && r.transit)
      ? `<div class="commute-section">
          <div class="commute-row">
            <span class="commute-mode">🚋 ÖPNV</span>
            <span class="commute-eta">→ ${transitETA}</span>
          </div>
          <span class="commute-duration">${r.transit} min</span>
          ${legsHtml}
        </div>`
      : showTransit
        ? `<div class="commute-section commute-section-empty">
          <div class="commute-row">
            <span class="commute-mode">🚋 ÖPNV</span>
            <span class="commute-eta">--</span>
          </div>
        </div>`
        : '';

    // Bike section
    const showBike = HOMEBOARD_CONFIG.commute.showBike !== false;
    const bikeSection = (showBike && r.bike)
      ? `<div class="commute-section">
          <div class="commute-row">
            <span class="commute-mode">🚲 Rad</span>
            <span class="commute-eta">→ ${bikeETA}</span>
          </div>
          <span class="commute-duration">${r.bike} min · ${r.bikeKm || '--'} km</span>
        </div>`
      : showBike
        ? `<div class="commute-section commute-section-empty">
          <div class="commute-row">
            <span class="commute-mode">🚲 Rad</span>
            <span class="commute-eta">--</span>
          </div>
        </div>`
        : '';

    container.innerHTML = `<div class="commute-dest">
      ${transitSection}
      ${bikeSection}
    </div>`;
  }

  function formatETA(now, minutes) {
    const eta = new Date(now.getTime() + minutes * 60000);
    return `${eta.getHours().toString().padStart(2, '0')}:${eta.getMinutes().toString().padStart(2, '0')}`;
  }

  return { init, switchTo };
})();
