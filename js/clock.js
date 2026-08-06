/**
 * Clock module - displays current time and date
 */
const Clock = (() => {
  let timeEl, dateEl;

  function init() {
    timeEl = document.getElementById('time');
    dateEl = document.getElementById('date');
    update();
    setInterval(update, 1000);
  }

  function update() {
    const now = new Date();

    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    timeEl.textContent = `${hours}:${minutes}`;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = now.toLocaleDateString(undefined, options);
  }

  return { init };
})();
