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

    // Pick a random interesting event (prefer events from last 500 years)
    const recent = events.filter(e => e.year && e.year > 1500);
    const pool = recent.length > 0 ? recent : events;
    const event = pool[Math.floor(Math.random() * pool.length)];

    document.getElementById('history-year').textContent = event.year || '';
    document.getElementById('history-text').textContent = event.text || '';
  }

  return { init };
})();
