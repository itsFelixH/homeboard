/**
 * Plant watering tracker - simple version
 * One button to mark all plants as watered, shows days since last watering
 * Synced across devices via shared server state
 */
const Plants = (() => {
  const STATE_KEY = 'plants_last';

  async function init() {
    await render();
  }

  async function getLastWatered() {
    const stored = await State.get(STATE_KEY);
    return stored ? new Date(stored) : null;
  }

  async function waterNow() {
    await State.set(STATE_KEY, new Date().toISOString());
    await render();
  }

  async function render() {
    const container = document.getElementById('plants-content');
    const lang = Lang.get();
    const last = await getLastWatered();

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
    const warningDays = (HOMEBOARD_CONFIG.plants && HOMEBOARD_CONFIG.plants.warningDays) || 7;
    const soonDays = Math.max(warningDays - 2, 3);
    let rec = '';

    if (daysSince === 0) {
      statusText = lang === 'de' ? 'Heute gegossen ✓' : 'Watered today ✓';
      statusClass = 'plants-status-ok';
    } else if (daysSince === 1) {
      statusText = lang === 'de' ? 'Gestern gegossen' : 'Watered yesterday';
      statusClass = 'plants-status-ok';
    } else {
      statusText = lang === 'de' ? `Vor ${daysSince} Tagen gegossen` : `${daysSince} days ago`;
      statusClass = daysSince >= warningDays ? 'plants-status-overdue' : daysSince >= soonDays ? 'plants-status-soon' : 'plants-status-ok';
      if (daysSince >= warningDays) {
        rec = lang === 'de' ? '💧 Jetzt gießen!' : '💧 Water them now!';
      } else if (daysSince >= soonDays) {
        rec = lang === 'de' ? '🪴 Morgen gießen' : '🪴 Water tomorrow';
      }
    }

    container.innerHTML = `<div class="plants-display">
      <div class="plants-info">
        <span class="plants-status ${statusClass}">${daysSince >= warningDays ? '⚠️' : '🌱'} ${statusText}</span>
        ${rec ? `<span class="metric-rec">${rec}</span>` : ''}
      </div>
      <button class="plants-water-btn-main" onclick="Plants.waterNow()">💧</button>
    </div>`;
  }

  return { init, waterNow };
})();
