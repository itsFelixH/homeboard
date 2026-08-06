/**
 * Commute module - displays estimated commute time
 *
 * For a fully functional version, integrate with:
 * - Google Maps Directions API
 * - Here Maps Routing API
 * - or a local transit API
 *
 * This starter version shows a placeholder that you can swap out.
 */
const Commute = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.commute;
    if (!config.origin || !config.destination) {
      document.getElementById('commute-time').textContent = '--';
      document.getElementById('commute-route').textContent = 'Configure in config.js';
      return;
    }
    fetchCommute();
    refreshInterval = setInterval(fetchCommute, config.refreshMinutes * 60 * 1000);
  }

  async function fetchCommute() {
    const config = HOMEBOARD_CONFIG.commute;

    // Placeholder: replace with actual API call
    // Example with Google Directions API:
    // const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${config.origin}&destination=${config.destination}&mode=${config.mode}&key=${config.apiKey}`;

    try {
      // Simulated response - replace with real API integration
      const estimate = getStaticEstimate();
      render(estimate);
    } catch (err) {
      console.error('Commute fetch failed:', err);
      document.getElementById('commute-time').textContent = '--';
      document.getElementById('commute-route').textContent = 'Error loading commute';
    }
  }

  function getStaticEstimate() {
    // Replace this with your actual API call
    return {
      duration: '25 min',
      route: `${HOMEBOARD_CONFIG.commute.mode} to work`
    };
  }

  function render(data) {
    document.getElementById('commute-time').textContent = data.duration;
    document.getElementById('commute-route').textContent = data.route;
  }

  return { init };
})();
