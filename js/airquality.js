/**
 * Air Quality module - uses Open-Meteo Air Quality API
 * https://open-meteo.com/en/docs/air-quality-api
 * No API key needed
 */
const AirQuality = (() => {
  let refreshInterval;

  // European AQI levels
  const AQI_LEVELS = [
    { max: 20, label: 'Good', color: '#4caf50' },
    { max: 40, label: 'Fair', color: '#8bc34a' },
    { max: 60, label: 'Moderate', color: '#ffeb3b' },
    { max: 80, label: 'Poor', color: '#ff9800' },
    { max: 100, label: 'Very Poor', color: '#f44336' },
    { max: Infinity, label: 'Hazardous', color: '#9c27b0' }
  ];

  function init() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    if (!latitude || !longitude) {
      document.getElementById('aqi-value').textContent = '--';
      document.getElementById('aqi-label').textContent = 'Set location in config';
      return;
    }
    fetchAQI();
    refreshInterval = setInterval(fetchAQI, 30 * 60 * 1000); // every 30 min
  }

  async function fetchAQI() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=european_aqi,pm2_5,pm10`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      console.error('Air quality fetch failed:', err);
      document.getElementById('aqi-value').textContent = '--';
      document.getElementById('aqi-label').textContent = 'Error loading AQI';
    }
  }

  function render(data) {
    const current = data.current;
    const aqi = current.european_aqi;
    const level = AQI_LEVELS.find(l => aqi <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];

    document.getElementById('aqi-value').textContent = aqi;
    document.getElementById('aqi-label').textContent = level.label;
    document.getElementById('aqi-value').style.color = level.color;

    document.getElementById('aqi-pm25').textContent = `PM2.5: ${current.pm2_5} \u00B5g/m\u00B3`;
    document.getElementById('aqi-pm10').textContent = `PM10: ${current.pm10} \u00B5g/m\u00B3`;
  }

  return { init };
})();
