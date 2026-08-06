/**
 * Useless Facts module - displays today's random useless fact
 * https://uselessfacts.jsph.pl/
 */
const Facts = (() => {
  function init() {
    fetchFact();
  }

  async function fetchFact() {
    const url = 'https://uselessfacts.jsph.pl/api/v2/facts/today?language=en';

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      console.error('Fact fetch failed:', err);
      document.getElementById('fact-text').textContent = 'Could not load today\'s fact.';
    }
  }

  function render(data) {
    document.getElementById('fact-text').textContent = data.text;
  }

  return { init };
})();
