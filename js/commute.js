/**
 * Commute module - uses Transitous (MOTIS) API for public transit routing
 * https://transitous.org/
 * API hosted at api.transitous.org (free, no key needed)
 */
const Commute = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.commute;
    if (!config.origin.latitude || !config.destination.latitude) {
      document.getElementById('commute-time').textContent = '--';
      document.getElementById('commute-route').textContent = 'Set origin/destination in config.js';
      return;
    }
    fetchCommute();
    refreshInterval = setInterval(fetchCommute, config.refreshMinutes * 60 * 1000);
  }

  async function fetchCommute() {
    const config = HOMEBOARD_CONFIG.commute;
    const { origin, destination } = config;

    // MOTIS API plan endpoint (OTP-compatible format used by Transitous)
    const url = `https://api.transitous.org/api/v1/plan?` +
      `fromPlace=${origin.latitude},${origin.longitude}` +
      `&toPlace=${destination.latitude},${destination.longitude}` +
      `&mode=TRANSIT,WALK` +
      `&numItineraries=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      console.error('Commute fetch failed:', err);
      document.getElementById('commute-time').textContent = '--';
      document.getElementById('commute-route').textContent = 'Error loading commute';
    }
  }

  function render(data) {
    if (!data.itineraries || data.itineraries.length === 0) {
      document.getElementById('commute-time').textContent = '--';
      document.getElementById('commute-route').textContent = 'No route found';
      return;
    }

    const itinerary = data.itineraries[0];
    const durationMin = Math.round(itinerary.duration / 60);

    // Build a summary of transit legs
    const transitLegs = itinerary.legs
      .filter(leg => leg.mode !== 'WALK')
      .map(leg => leg.route || leg.mode)
      .join(' \u2192 ');

    document.getElementById('commute-time').textContent = `${durationMin} min`;
    document.getElementById('commute-route').textContent = transitLegs || 'Walking only';
  }

  return { init };
})();
