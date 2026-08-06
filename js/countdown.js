/**
 * Countdown module - shows days until next vacation/event
 */
const Countdown = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.countdown;
    if (!config.date) {
      document.getElementById('countdown-days').textContent = '--';
      document.getElementById('countdown-label').textContent = 'Set date in config.js';
      return;
    }
    update();
    // Update once per hour (days don't change often)
    refreshInterval = setInterval(update, 60 * 60 * 1000);
  }

  function update() {
    const config = HOMEBOARD_CONFIG.countdown;
    const target = new Date(config.date + 'T00:00:00');
    const now = new Date();

    // Reset both to midnight for clean day calculation
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());

    const diffMs = targetMidnight - todayMidnight;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const daysEl = document.getElementById('countdown-days');
    const labelEl = document.getElementById('countdown-label');
    const sublabelEl = document.getElementById('countdown-sublabel');

    if (diffDays < 0) {
      daysEl.textContent = '\u2714';
      labelEl.textContent = config.label || 'Vacation';
      sublabelEl.textContent = 'Already started!';
    } else if (diffDays === 0) {
      daysEl.textContent = '\uD83C\uDF89';
      labelEl.textContent = config.label || 'Vacation';
      sublabelEl.textContent = 'Today!';
    } else {
      daysEl.textContent = diffDays;
      labelEl.textContent = config.label || 'Vacation';
      sublabelEl.textContent = diffDays === 1 ? 'day to go' : 'days to go';
    }
  }

  return { init };
})();
