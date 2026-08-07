/**
 * Word of the Day module
 * Uses random-word-api + Free Dictionary API for definitions
 * Picks one word per day (seeded by date) and shows definition
 */
const Word = (() => {
  // A curated list of interesting English words (fallback + seed pool)
  const WORDS = [
    'serendipity', 'ephemeral', 'luminous', 'mellifluous', 'petrichor',
    'ethereal', 'sonder', 'ineffable', 'eloquent', 'sanguine',
    'resilient', 'sublime', 'wanderlust', 'labyrinth', 'enigma',
    'cascade', 'zenith', 'solitude', 'epiphany', 'verdant',
    'aurora', 'halcyon', 'nefarious', 'oblivion', 'quixotic',
    'reverie', 'silhouette', 'talisman', 'umbra', 'vivacious',
    'whimsical', 'aberration', 'bucolic', 'clandestine', 'diaphanous',
    'effervescent', 'felicity', 'gossamer', 'harbinger', 'incandescent',
    'juxtapose', 'kaleidoscope', 'languid', 'mercurial', 'nebulous',
    'opulent', 'paradox', 'quintessence', 'rapture', 'scintillate',
    'tempest', 'utopia', 'venerable', 'wistful', 'xenial',
    'yearning', 'zephyr', 'aplomb', 'benevolent', 'catharsis',
    'dulcet', 'equanimity', 'fortuitous', 'gregarious', 'histrionic'
  ];

  function init() {
    fetchWord();
  }

  function getDailyWord() {
    // Use date as seed to get consistent word per day
    const now = new Date();
    const dayIndex = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
    return WORDS[dayIndex % WORDS.length];
  }

  async function fetchWord() {
    const word = getDailyWord();

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data[0]);
    } catch (err) {
      console.error('Word fetch failed:', err);
      document.getElementById('word-content').innerHTML =
        `<span class="word-title">${word}</span><span class="word-def">Could not load definition</span>`;
    }
  }

  function render(entry) {
    const container = document.getElementById('word-content');
    const word = entry.word;
    const phonetic = entry.phonetic || '';
    const meanings = entry.meanings || [];
    const firstMeaning = meanings[0] || {};
    const pos = firstMeaning.partOfSpeech || '';
    const defs = firstMeaning.definitions || [];
    const definition = defs[0]?.definition || '';

    container.innerHTML = `
      <div class="word-header">
        <span class="word-title">${word}</span>
        <span class="word-phonetic">${phonetic}</span>
      </div>
      <span class="word-pos">${pos}</span>
      <span class="word-def">${definition}</span>
    `;
  }

  return { init };
})();
