/**
 * UV Index module - uses currentuvindex.com API
 * https://currentuvindex.com/api
 * No API key needed
 */
const UV = (() => {
  let refreshInterval;

  const UV_LEVELS = [
    { max: 2, label: 'Low', color: '#4caf50' },
    { max: 5, label: 'Moderate', color: '#ffeb3b' },
    { max: 7, label: 'High', color: '#ff9800' },
    { max: 10, label: 'Very High', color: '#f44336' },
    { max: Infinity, label: 'Extreme', color: '#9c27b0' }
  ];

  function init() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    if (!latitude || !longitude) {
      document.getElementById('uv-value').textContent = '--';
      document.getElementById('uv-label').textContent = 'Set location in config';
      return;
    }
    fetchUV();
    refreshInterval = setInterval(fetchUV, 30 * 60 * 1000); // every 30 min
  }

  async function fetchUV() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    const url = `https://currentuvindex.com/api/v1/uvi?latitude=${latitude}&longitude=${longitude}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      console.error('UV index fetch failed:', err);
      document.getElementById('uv-value').textContent = '--';
      document.getElementById('uv-label').textContent = 'Error loading UV';
    }
  }

  function render(data) {
    const uvi = Math.round(data.now.uvi * 10) / 10;
    const level = UV_LEVELS.find(l => uvi <= l.max) || UV_LEVELS[UV_LEVELS.length - 1];
    const lang = Lang.get();

    document.getElementById('uv-value').textContent = uvi;
    document.getElementById('uv-label').textContent = level.label;
    document.getElementById('uv-value').style.color = level.color;

    const recEl = document.getElementById('uv-rec');
    if (recEl) recEl.textContent = getUvRec(uvi, lang);
  }

  function getUvRec(uvi, lang) {
    // Show safe outdoor hours when UV is high
    const hour = new Date().getHours();
    if (uvi > 5) {
      // Peak UV is typically 11:00–15:00
      if (lang === 'de') {
        if (hour < 11) return `🕶️ Sonnencreme · sicher bis 11:00`;
        if (hour >= 15) return `✓ UV sinkt — sicher draußen`;
        return `⚠️ Mittagssonne meiden · sicher ab 15:00`;
      }
      if (hour < 11) return `🕶️ Sunscreen · safe until 11:00`;
      if (hour >= 15) return `✓ UV dropping — safe outdoors`;
      return `⚠️ Avoid sun · safe after 15:00`;
    }
    if (lang === 'de') {
      if (uvi <= 2) return '';
      return '🧴 Sonnencreme empfohlen';
    }
    if (uvi <= 2) return '';
    return '🧴 Sunscreen recommended';
  }

  return { init };
})();
