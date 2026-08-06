/**
 * Sunrise/Sunset module - uses Open-Meteo daily endpoint
 * No API key needed
 */
const Sun = (() => {
  let refreshInterval;

  function init() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    if (!latitude || !longitude) {
      document.getElementById('sunrise-time').textContent = '--:--';
      document.getElementById('sunset-time').textContent = '--:--';
      return;
    }
    fetchSun();
    // Refresh once per hour (sunrise/sunset don't change often)
    refreshInterval = setInterval(fetchSun, 60 * 60 * 1000);
  }

  async function fetchSun() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    const today = new Date().toISOString().split('T')[0];

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=sunrise,sunset&timezone=auto&start_date=${today}&end_date=${today}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      console.error('Sunrise/sunset fetch failed:', err);
      document.getElementById('sunrise-time').textContent = '--:--';
      document.getElementById('sunset-time').textContent = '--:--';
    }
  }

  function render(data) {
    const daily = data.daily;
    if (!daily || !daily.sunrise || !daily.sunset) return;

    const sunrise = new Date(daily.sunrise[0]);
    const sunset = new Date(daily.sunset[0]);

    document.getElementById('sunrise-time').textContent = formatTime(sunrise);
    document.getElementById('sunset-time').textContent = formatTime(sunset);
  }

  function formatTime(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  return { init };
})();
