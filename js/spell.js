/**
 * Harry Potter Spell of the Day module
 * Uses hp-api.onrender.com (free, no key)
 * Shows a random spell each day + a random character quote
 */
const Spell = (() => {
  let spells = [];
  let characters = [];

  function init() {
    fetchData();
  }

  async function fetchData() {
    try {
      const [spellRes, charRes] = await Promise.all([
        fetch('https://hp-api.onrender.com/api/spells'),
        fetch('https://hp-api.onrender.com/api/characters')
      ]);

      if (spellRes.ok) spells = await spellRes.json();
      if (charRes.ok) characters = await charRes.json();

      render();
    } catch (err) {
      console.error('HP API fetch failed:', err);
      document.getElementById('spell-content').innerHTML =
        '<span class="spell-error">Could not load spell</span>';
    }
  }

  function getDailyIndex(arrayLength) {
    const now = new Date();
    const seed = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
    return seed % arrayLength;
  }

  function render() {
    const container = document.getElementById('spell-content');

    let html = '';

    // Spell of the day
    if (spells.length > 0) {
      const spell = spells[getDailyIndex(spells.length)];
      html += `<div class="spell-main">
        <span class="spell-name">${spell.name}</span>
        <span class="spell-desc">${spell.description || 'Unknown effect'}</span>
      </div>`;
    }

    // Character of the day (with house + patronus)
    if (characters.length > 0) {
      // Pick from characters that have interesting info
      const interesting = characters.filter(c => c.house && c.patronus);
      const pool = interesting.length > 0 ? interesting : characters.filter(c => c.house);
      if (pool.length > 0) {
        const char = pool[getDailyIndex(pool.length)];
        const houseEmoji = { Gryffindor: '🦁', Slytherin: '🐍', Ravenclaw: '🦅', Hufflepuff: '🦡' };
        const emoji = houseEmoji[char.house] || '🧙';
        const patronus = char.patronus ? ` · Patronus: ${char.patronus}` : '';
        html += `<div class="spell-character">
          <span class="spell-char-name">${emoji} ${char.name}</span>
          <span class="spell-char-info">${char.house}${patronus}</span>
        </div>`;
      }
    }

    container.innerHTML = html || '<span class="spell-error">No data</span>';
  }

  return { init };
})();
