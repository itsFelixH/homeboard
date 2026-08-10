/**
 * This Day in History module - Wikipedia On This Day API
 * https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/{MM}/{DD}
 * Free, no key needed
 */
const History = (() => {
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
      render(data.events || []);
    } catch (err) {
      console.error('History fetch failed:', err);
      document.getElementById('history-text').textContent = 'Could not load today\'s history.';
    }
  }

  function render(events) {
    if (events.length === 0) {
      document.getElementById('history-text').textContent = 'No events found for today.';
      return;
    }

    // Pick a random interesting event (prefer events from configured year onwards)
    // Use date as seed for consistent daily pick
    const now = new Date();
    const seed = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
    const minYear = (HOMEBOARD_CONFIG.history && HOMEBOARD_CONFIG.history.minYear) || 1500;
    const recent = events.filter(e => e.year && e.year > minYear);
    const pool = recent.length > 0 ? recent : events;
    const event = pool[seed % pool.length];

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
  }

  return { init };
})();
