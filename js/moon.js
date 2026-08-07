/**
 * Moon phase module - adds moon phase to the weather card
 * Uses simple calculation (no API needed)
 */
const Moon = (() => {
  const PHASES = [
    { name: 'Neumond', icon: '🌑' },
    { name: 'Zunehmend', icon: '🌒' },
    { name: 'Erstes Viertel', icon: '🌓' },
    { name: 'Zunehmend', icon: '🌔' },
    { name: 'Vollmond', icon: '🌕' },
    { name: 'Abnehmend', icon: '🌖' },
    { name: 'Letztes Viertel', icon: '🌗' },
    { name: 'Abnehmend', icon: '🌘' }
  ];

  function init() {
    const phase = getMoonPhase(new Date());
    const el = document.getElementById('moon-phase');
    if (el) {
      el.innerHTML = `<span title="${phase.name}">${phase.icon}</span>`;
    }
  }

  function getMoonPhase(date) {
    // Simple moon phase calculation
    // Based on a known new moon: Jan 6, 2000
    const knownNew = new Date(2000, 0, 6, 18, 14);
    const cycle = 29.53058867; // days
    const diff = (date - knownNew) / 86400000;
    const phase = ((diff % cycle) + cycle) % cycle;
    const index = Math.round(phase / (cycle / 8)) % 8;
    return PHASES[index];
  }

  return { init };
})();
