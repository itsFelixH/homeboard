/**
 * Berlin Events module
 * Links to berlin.de events for today
 * Could be enhanced with a proper API when available
 */
const Events = (() => {
  function init() {
    const container = document.getElementById('events-list');
    if (!container) return;

    const today = new Date();
    const dateStr = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
    const urlDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    container.innerHTML = `
      <a href="https://www.berlin.de/tickets/heute/" target="_blank" class="event-link">
        <i data-lucide="ticket" class="icon-sm"></i> Events heute
      </a>
      <a href="https://www.berlin.de/tickets/konzerte/" target="_blank" class="event-link">
        <i data-lucide="music" class="icon-sm"></i> Konzerte
      </a>
      <a href="https://www.berlin.de/tickets/theater/" target="_blank" class="event-link">
        <i data-lucide="drama" class="icon-sm"></i> Theater
      </a>
      <a href="https://rausgegangen.de/berlin/" target="_blank" class="event-link">
        <i data-lucide="map-pin" class="icon-sm"></i> Rausgegangen
      </a>
    `;
    // Re-render lucide icons for dynamically added content
    if (window.lucide) lucide.createIcons();
  }

  return { init };
})();
