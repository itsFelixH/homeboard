/**
 * Plant watering tracker - simple version
 * One button to mark all plants as watered, shows days since last watering
 * Stored in localStorage
 */
const Plants = (() => {
  const STORAGE_KEY = 'homeboard_plants_last';

  function init() {
    render();
  }

  function getLastWatered() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Date(stored) : null;
  }

  function waterNow() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    render();
  }

  function render() {
    const container = document.getElementById('plants-content');
    const lang = Lang.get();
    const last = getLastWatered();

    if (!last) {
      container.innerHTML = `<div class="plants-display">
        <span class="plants-status plants-status-overdue">🌱 ${lang === 'de' ? 'Noch nie gegossen' : 'Never watered'}</span>
        <button class="plants-water-btn-main" onclick="Plants.waterNow()">💧</button>
      </div>`;
      return;
    }

    const now = new Date();
    const daysSince = Math.floor((now - last) / (1000 * 60 * 60 * 24));

    let statusText, statusClass;
    if (daysSince === 0) {
      statusText = lang === 'de' ? 'Heute gegossen ✓' : 'Watered today ✓';
      statusClass = 'plants-status-ok';
    } else if (daysSince === 1) {
      statusText = lang === 'de' ? 'Gestern gegossen' : 'Watered yesterday';
      statusClass = 'plants-status-ok';
    } else {
      statusText = lang === 'de' ? `Vor ${daysSince} Tagen gegossen` : `${daysSince} days ago`;
      statusClass = daysSince >= 7 ? 'plants-status-overdue' : daysSince >= 5 ? 'plants-status-soon' : 'plants-status-ok';
    }

    container.innerHTML = `<div class="plants-display">
      <div class="plants-info">
        <span class="plants-status ${statusClass}">${daysSince >= 7 ? '⚠️' : '🌱'} ${statusText}</span>
      </div>
      <button class="plants-water-btn-main" onclick="Plants.waterNow()">💧</button>
    </div>`;
  }

  return { init, waterNow };
})();
