/**
 * Plant watering tracker - simple version
 * One button to mark all plants as watered, shows days since last watering
 * Stored in localStorage
 */
const Plants = (() => {
  const STORAGE_KEY = 'homeboard_plants_last';
  const INTERVAL_KEY = 'homeboard_plants_interval';
  const DEFAULT_INTERVAL = 7; // days

  function init() {
    render();
  }

  function getLastWatered() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Date(stored) : null;
  }

  function getInterval() {
    return parseInt(localStorage.getItem(INTERVAL_KEY)) || DEFAULT_INTERVAL;
  }

  function waterNow() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    render();
  }

  function render() {
    const container = document.getElementById('plants-content');
    const lang = Lang.get();
    const last = getLastWatered();
    const interval = getInterval();

    if (!last) {
      container.innerHTML = `<div class="plants-prompt">
        <button class="plants-water-btn-main" onclick="Plants.waterNow()">💧 ${lang === 'de' ? 'Gegossen!' : 'Watered!'}</button>
        <span class="plants-hint">${lang === 'de' ? 'Noch nie gegossen' : 'Never watered yet'}</span>
      </div>`;
      return;
    }

    const now = new Date();
    const daysSince = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    const daysLeft = interval - daysSince;
    const overdue = daysLeft <= 0;
    const soon = daysLeft === 1;

    let statusText, statusClass;
    if (overdue) {
      statusText = lang === 'de' ? 'Gießen fällig!' : 'Watering due!';
      statusClass = 'plants-status-overdue';
    } else if (soon) {
      statusText = lang === 'de' ? 'Morgen gießen' : 'Water tomorrow';
      statusClass = 'plants-status-soon';
    } else {
      statusText = lang === 'de' ? `Nächstes Gießen in ${daysLeft} T.` : `Next in ${daysLeft} days`;
      statusClass = 'plants-status-ok';
    }

    let lastText;
    if (daysSince === 0) lastText = lang === 'de' ? 'Heute gegossen' : 'Watered today';
    else if (daysSince === 1) lastText = lang === 'de' ? 'Gestern gegossen' : 'Watered yesterday';
    else lastText = lang === 'de' ? `Vor ${daysSince} Tagen gegossen` : `Watered ${daysSince} days ago`;

    container.innerHTML = `<div class="plants-display">
      <div class="plants-info">
        <span class="plants-status ${statusClass}">${overdue ? '⚠️' : '🌱'} ${statusText}</span>
        <span class="plants-last">${lastText}</span>
      </div>
      <button class="plants-water-btn-main" onclick="Plants.waterNow()">💧</button>
    </div>`;
  }

  return { init, waterNow };
})();
