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
              const to = (leg.Destination?.name || '').replace(' (Berlin)', '').replace(' Bhf', '');
              const dur = parsePTDuration(leg.duration);
              if (!name || name === 'Fußweg' || leg.type === 'WALK') {
                return { mode: 'WALK', duration: dur };
              }
              const icon = name.startsWith('U') ? '🚇' : name.startsWith('Bus') ? '🚌' : '🚋';
              return { mode: 'TRANSIT', line: name, to, duration: dur, icon };
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
              const to = (leg.to?.name || '').replace(' (Berlin)', '');
              const icon = leg.mode === 'SUBWAY' ? '🚇' : leg.mode === 'BUS' ? '🚌' : '🚋';
              return { mode: 'TRANSIT', line, to, duration: dur, icon };
            });
          }
        }
      } catch (err) {
        console.error(`Transitous failed for ${dest.label}:`, err);
      }
    }

    // Bike via OSRM (× 1.5 correction)
    try {
      const url = `https://router.project-osrm.org/route/v1/cycling/` +
        `${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.code === 'Ok' && data.routes.length > 0) {
          result.bike = Math.round((data.routes[0].duration / 60) * 1.5);
          result.bikeKm = (data.routes[0].distance / 1000).toFixed(1);
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

    const transitText = r.transit ? `${r.transit} min` : '--';
    const bikeText = r.bike ? `${r.bike} min` : '--';
    const bikeKm = r.bikeKm ? `${r.bikeKm} km` : '';

    let legsHtml = '';
    if (r.transitLegs && r.transitLegs.length > 0) {
      const parts = r.transitLegs.map(leg => {
        if (leg.mode === 'WALK') return `<span class="leg-walk">🚶 ${leg.duration}′</span>`;
        return `<span class="leg-line">${leg.icon} ${leg.line}</span><span class="leg-dest">→ ${leg.to}</span>`;
      });
      legsHtml = `<div class="commute-route-legs">${parts.join('<span class="leg-sep">·</span>')}</div>`;
    }

    container.innerHTML = `<div class="commute-dest">
      <div class="commute-split">
        <div class="commute-transit">
          <span class="commute-mode-label">🚋 ÖPNV</span>
          <span class="commute-mode-value">${transitText}</span>
          ${legsHtml}
        </div>
        <div class="commute-bike">
          <span class="commute-mode-label">🚲 Rad</span>
          <span class="commute-mode-value">${bikeText}</span>
          ${bikeKm ? `<span class="commute-mode-sub">${bikeKm}</span>` : ''}
        </div>
      </div>
    </div>`;
  }

  return { init, switchTo };
})();
