/**
 * Pollen module - uses Open-Meteo Air Quality API
 * https://open-meteo.com/en/docs/air-quality-api
 * No API key needed
 */
const Pollen = (() => {
  let refreshInterval;

  // Pollen levels (grains/m³) - approximate thresholds
  const LEVELS = [
    { max: 0, label: 'None', color: '#4caf50' },
    { max: 10, label: 'Low', color: '#8bc34a' },
    { max: 30, label: 'Moderate', color: '#ffeb3b' },
    { max: 60, label: 'High', color: '#ff9800' },
    { max: Infinity, label: 'Very High', color: '#f44336' }
  ];

  function init() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    if (!latitude || !longitude) return;
    fetchPollen();
    refreshInterval = setInterval(fetchPollen, 60 * 60 * 1000); // hourly
  }

  async function fetchPollen() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=birch_pollen,grass_pollen,alder_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data.current);
    } catch (err) {
      console.error('Pollen fetch failed:', err);
      document.getElementById('pollen-list').innerHTML =
        '<span class="pollen-error">Error loading pollen data</span>';
    }
  }

  function render(current) {
    if (!current) return;

    const types = [
      { key: 'grass_pollen', name: 'Grass', emoji: '🌾' },
      { key: 'birch_pollen', name: 'Birch', emoji: '🌳' },
      { key: 'alder_pollen', name: 'Alder', emoji: '🌿' },
      { key: 'mugwort_pollen', name: 'Mugwort', emoji: '🍃' },
      { key: 'ragweed_pollen', name: 'Ragweed', emoji: '🌱' },
      { key: 'olive_pollen', name: 'Olive', emoji: '🫒' }
    ];

    // Only show types with any pollen detected (or all if none)
    const active = types.filter(t => current[t.key] > 0);
    const display = active.length > 0 ? active : types.slice(0, 3);

    const container = document.getElementById('pollen-list');

    // Get previous values for trend
    State.get('pollen_previous').then(prev => {
      const prevData = prev || {};

      container.innerHTML = display.map(t => {
        const value = current[t.key] || 0;
        const level = LEVELS.find(l => value <= l.max) || LEVELS[LEVELS.length - 1];
        // Trend arrow
        let trend = '';
        const prevVal = prevData[t.key];
        if (prevVal !== undefined) {
          if (value > prevVal + 5) trend = ' <span class="forecast-warmer">↑</span>';
          else if (value < prevVal - 5) trend = ' <span class="forecast-colder">↓</span>';
        }
        return `<div class="pollen-item">
          <span class="pollen-type">${t.emoji} ${t.name}</span>
          <span class="pollen-level" style="color:${level.color}">${level.label}${trend}</span>
        </div>`;
      }).join('');

      // Actionable recommendation
      const lang = Lang.get();
      const highTypes = types.filter(t => (current[t.key] || 0) > 30);
      let rec = '';
      if (highTypes.length > 0) {
        const names = highTypes.map(t => t.name).join(', ');
        rec = lang === 'de'
          ? `💊 Antihistaminikum empfohlen (${names})`
          : `💊 Consider antihistamine (${names})`;
      } else if (types.some(t => (current[t.key] || 0) > 10)) {
        rec = lang === 'de' ? '😮‍💨 Fenster geschlossen halten' : '😮‍💨 Keep windows closed';
      }
      if (rec) {
        container.innerHTML += `<div class="metric-rec">${rec}</div>`;
      }

      // Store current values for next comparison
      const toStore = {};
      types.forEach(t => { toStore[t.key] = current[t.key] || 0; });
      State.set('pollen_previous', toStore);
    });
  }

  return { init };
})();
