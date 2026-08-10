/**
 * This Day in History module - Wikipedia On This Day API
 * https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/{MM}/{DD}
 * Free, no key needed. Shows multiple events with shuffle navigation.
 */
const History = (() => {
  let cachedEvents = [];
  let currentIndex = 0;

  function init() {
    fetchHistory();
  }

  async function fetchHistory() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${month}/${day}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = data.events || [];

      // Filter to interesting events (after minYear)
      const minYear = (HOMEBOARD_CONFIG.history && HOMEBOARD_CONFIG.history.minYear) || 1500;
      const filtered = events.filter(e => e.year && e.year > minYear);
      cachedEvents = filtered.length > 0 ? filtered : events;

      // Shuffle deterministically by date seed, then start from first
      const seed = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
      cachedEvents.sort((a, b) => {
        const ha = ((a.year || 0) * 7 + seed) % 1000;
        const hb = ((b.year || 0) * 7 + seed) % 1000;
        return ha - hb;
      });

      currentIndex = 0;
      render();
    } catch (err) {
      console.error('History fetch failed:', err);
      document.getElementById('history-text').textContent = 'Could not load today\'s history.';
    }
  }

  function next() {
    if (cachedEvents.length === 0) return;
    currentIndex = (currentIndex + 1) % cachedEvents.length;
    render();
  }

  function prev() {
    if (cachedEvents.length === 0) return;
    currentIndex = (currentIndex - 1 + cachedEvents.length) % cachedEvents.length;
    render();
  }

  function render() {
    if (cachedEvents.length === 0) {
      document.getElementById('history-text').textContent = 'No events found for today.';
      return;
    }

    const event = cachedEvents[currentIndex];

    // Get Wikipedia link from the first related page
    const pages = event.pages || [];
    const wikiUrl = pages.length > 0
      ? (pages[0].content_urls?.desktop?.page || '')
      : '';

    document.getElementById('history-year').textContent = event.year || '';

    const textEl = document.getElementById('history-text');
    if (wikiUrl) {
      textEl.innerHTML = `<a href="${wikiUrl}" target="_blank" class="history-link">${event.text || ''}</a>`;
    } else {
      textEl.textContent = event.text || '';
    }

    // Navigation
    let navContainer = document.querySelector('.card-history .history-nav');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.className = 'history-nav';
      const header = document.querySelector('.card-history .card-header');
      if (header) header.appendChild(navContainer);
    }
    if (cachedEvents.length > 1) {
      navContainer.innerHTML = `<div class="card-nav">
        <button class="card-nav-btn" onclick="History.prev()" aria-label="Previous">‹</button>
        <span class="card-nav-label">${currentIndex + 1}/${cachedEvents.length}</span>
        <button class="card-nav-btn" onclick="History.next()" aria-label="Next">›</button>
      </div>`;
    }
  }

  return { init, next, prev };
})();
