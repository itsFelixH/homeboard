/**
 * Homeboard - YAML Config Loader
 *
 * Fetches config.local.yaml (falls back to config.template.yaml),
 * parses it with js-yaml, and exposes it as the global HOMEBOARD_CONFIG.
 *
 * Features:
 * - Visible error overlay if config fails to load
 * - sessionStorage cache to avoid re-fetching on page refresh
 * - Flattened config: all settings for a card live under cards.<id>
 * - Warns about unknown card IDs (typo detection)
 */

// Global config object — modules read from this
let HOMEBOARD_CONFIG = {};

const ConfigLoader = (() => {
  const CACHE_KEY = 'homeboard_config_cache';
  const CACHE_VERSION = 4;

  async function load() {
    let yamlText = null;

    // Try sessionStorage cache first (avoids re-fetch on 4h auto-refresh)
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { version, text } = JSON.parse(cached);
        if (version === CACHE_VERSION) {
          yamlText = text;
        }
      }
    } catch (e) { /* ignore corrupt cache */ }

    // Fetch fresh if no cache
    if (!yamlText) {
      try {
        const res = await fetch('config.local.yaml');
        if (res.ok) {
          yamlText = await res.text();
        }
      } catch (e) { /* ignore */ }

      if (!yamlText) {
        try {
          const res = await fetch('config.template.yaml');
          if (res.ok) {
            yamlText = await res.text();
          }
        } catch (e) { /* ignore */ }
      }

      // Cache for next refresh
      if (yamlText) {
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, text: yamlText }));
        } catch (e) { /* storage full or disabled */ }
      }
    }

    if (!yamlText) {
      showError('Config not found', 'Create config.local.yaml from the template:\n\ncp config.template.yaml config.local.yaml');
      return;
    }

    // Parse YAML
    let raw;
    try {
      raw = jsyaml.load(yamlText);
    } catch (e) {
      showError('Config parse error', e.message || 'Invalid YAML syntax');
      return;
    }

    if (!raw || typeof raw !== 'object') {
      showError('Config invalid', 'The config file is empty or not a valid YAML object.');
      return;
    }

    // Build the HOMEBOARD_CONFIG object
    HOMEBOARD_CONFIG = buildConfig(raw);
  }

  /** Force re-fetch on next load (called externally if needed) */
  function invalidateCache() {
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
  }

  function showError(title, detail) {
    console.error(`[Homeboard] ${title}: ${detail}`);
    const dashboard = document.querySelector('.dashboard');
    if (!dashboard) return;

    dashboard.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:2rem;text-align:center;color:#e2e8f0;font-family:system-ui,sans-serif;">
        <div style="font-size:3rem;margin-bottom:1rem;">⚠️</div>
        <h1 style="font-size:1.5rem;margin:0 0 0.5rem;color:#f87171;">${title}</h1>
        <pre style="background:#1e293b;padding:1rem 1.5rem;border-radius:0.5rem;font-size:0.85rem;max-width:600px;white-space:pre-wrap;text-align:left;color:#94a3b8;">${detail}</pre>
      </div>`;
  }

  function buildConfig(raw) {
    const config = {};
    const cards = raw.cards || {};

    // --- Cards section (preserved as-is for app.js card management) ---
    config.cards = cards;

    // --- Warn about unknown card IDs ---
    const KNOWN_CARDS = new Set([
      'weather', 'rain', 'departures', 'commute', 'aqi', 'uv', 'pollen',
      'plants', 'calendar', 'birthdays', 'countdown', 'news', 'word',
      'spell', 'history', 'trash', 'github', 'xkcd', 'packages', 'email', 'slideshow'
    ]);
    Object.keys(cards).forEach(id => {
      if (!KNOWN_CARDS.has(id)) {
        console.warn(`[Homeboard] Unknown card "${id}" in config — typo? Available: ${[...KNOWN_CARDS].join(', ')}`);
      }
    });

    // --- Location ---
    config.location = raw.location || { latitude: 0, longitude: 0, address: '' };
    if (!config.location.address) config.location.address = '';

    // --- Greeting ---
    config.greeting = raw.greeting || {};

    // --- Weather ---
    const w = cards.weather || {};
    config.weather = {
      units: w.units || 'celsius',
      refreshMinutes: w.refreshMinutes || 15,
      showClothing: w.showClothing !== false,
      showForecast: w.showForecast !== false,
      forecastDays: w.forecastDays || 4
    };

    // --- Rain ---
    const r = cards.rain || {};
    config.rain = {
      refreshMinutes: r.refreshMinutes || 15,
      forecastHours: r.forecastHours || 12
    };

    // --- Commute ---
    const commuteCard = cards.commute || {};
    const commuteOrigin = commuteCard.origin
      && (commuteCard.origin.latitude || commuteCard.origin.longitude)
      ? commuteCard.origin
      : config.location;
    config.commute = {
      origin: commuteOrigin,
      destinations: commuteCard.destinations || [],
      refreshMinutes: commuteCard.refreshMinutes || 10,
      showBike: commuteCard.showBike !== false,
      showTransit: commuteCard.showTransit !== false,
      bikeSpeed: commuteCard.bikeSpeed || 13,
      walkSpeed: commuteCard.walkSpeed || 5
    };

    // --- Calendar ---
    const calCard = cards.calendar || {};
    config.calendar = {
      icsUrl: calCard.icsUrl || '',
      maxEvents: calCard.maxEvents || 5,
      refreshMinutes: calCard.refreshMinutes || 30,
      showTomorrow: calCard.showTomorrow !== false,
      showCommute: calCard.showCommute !== false,
      hidePatterns: calCard.hidePatterns || []
    };

    // --- Birthdays ---
    const bdayCard = cards.birthdays || {};
    config.birthdays = {
      icsUrl: bdayCard.icsUrl || '',
      refreshMinutes: bdayCard.refreshMinutes || 60,
      lookaheadDays: bdayCard.lookaheadDays || 7
    };

    // --- Slideshow ---
    const slideCard = cards.slideshow || {};
    config.slideshow = {
      images: slideCard.images || [],
      intervalSeconds: slideCard.intervalSeconds || 30
    };

    // --- Departures ---
    const depCard = cards.departures || {};
    config.departures = {
      stopId: depCard.stopId || '',
      stops: depCard.stops || [],
      durationMinutes: depCard.durationMinutes || 30,
      maxResults: depCard.maxResults || 5,
      refreshSeconds: depCard.refreshSeconds || 30,
      hafasAccessId: depCard.hafasAccessId || ''
    };

    // --- Countdown ---
    const countCard = cards.countdown || {};
    config.countdown = {
      date: countCard.date || '',
      label: countCard.label || 'Vacation',
      names: countCard.names || {},
      maxVacations: countCard.maxVacations || 3,
      keyword: countCard.keyword || 'Urlaub'
    };

    // --- Trash ---
    const trashCard = cards.trash || {};
    config.trash = {
      icsUrl: trashCard.icsUrl || '',
      refreshHours: trashCard.refreshHours || 6,
      previewDays: trashCard.previewDays || 7
    };

    // --- Packages ---
    const pkgCard = cards.packages || {};
    config.packages = {
      dhlApiKey: pkgCard.dhlApiKey || '',
      refreshMinutes: pkgCard.refreshMinutes || 30
    };

    // --- GitHub ---
    const ghCard = cards.github || {};
    config.github = {
      username: ghCard.username || '',
      refreshMinutes: ghCard.refreshMinutes || 30,
      maxEvents: ghCard.maxEvents || 4
    };

    // --- Email ---
    const emailCard = cards.email || {};
    config.email = {
      clientId: emailCard.clientId || '',
      clientSecret: emailCard.clientSecret || '',
      refreshMinutes: emailCard.refreshMinutes || 5
    };

    // --- AQI ---
    const aqiCard = cards.aqi || {};
    config.aqi = {
      refreshMinutes: aqiCard.refreshMinutes || 30
    };

    // --- UV ---
    const uvCard = cards.uv || {};
    config.uv = {
      refreshMinutes: uvCard.refreshMinutes || 30
    };

    // --- Pollen ---
    const pollenCard = cards.pollen || {};
    config.pollen = {
      refreshMinutes: pollenCard.refreshMinutes || 60,
      types: pollenCard.types || []
    };

    // --- Plants ---
    const plantsCard = cards.plants || {};
    config.plants = {
      warningDays: plantsCard.warningDays || 7
    };

    // --- News ---
    const newsCard = cards.news || {};
    config.news = {
      refreshMinutes: newsCard.refreshMinutes || 10,
      perPage: newsCard.perPage || 5,
      cycleSeconds: newsCard.cycleSeconds || 30,
      defaultCategory: newsCard.defaultCategory || 'homepage'
    };

    // --- Word ---
    config.word = {};

    // --- Spell (Harry Potter) ---
    const spellCard = cards.spell || {};
    config.spell = {
      cycleSeconds: spellCard.cycleSeconds || 60
    };

    // --- History ---
    const histCard = cards.history || {};
    config.history = {
      minYear: histCard.minYear || 1500
    };

    // --- XKCD ---
    config.xkcd = {};

    return config;
  }

  return { load, invalidateCache };
})();

window.getTransitLineStyle = function(line) {
  if (!line) return { bg: '#6366f1', fg: '#ffffff' };
  const clean = line.trim().toUpperCase();
  
  // S-Bahn
  if (clean.startsWith('S') && (clean === 'S' || /^[S]\d+/.test(clean))) {
    switch (clean) {
      case 'S1': return { bg: '#de4da5', fg: '#ffffff' };
      case 'S2': return { bg: '#005f27', fg: '#ffffff' };
      case 'S25': return { bg: '#005f27', fg: '#ffffff' };
      case 'S26': return { bg: '#005f27', fg: '#ffffff' };
      case 'S3': return { bg: '#0a4c8b', fg: '#ffffff' };
      case 'S41': return { bg: '#a23b1e', fg: '#ffffff' };
      case 'S42': return { bg: '#c26e30', fg: '#ffffff' };
      case 'S45': return { bg: '#c38736', fg: '#ffffff' };
      case 'S46': return { bg: '#c38736', fg: '#ffffff' };
      case 'S47': return { bg: '#c38736', fg: '#ffffff' };
      case 'S5': return { bg: '#ff5900', fg: '#ffffff' };
      case 'S7': return { bg: '#6f4e9c', fg: '#ffffff' };
      case 'S75': return { bg: '#6f4e9c', fg: '#ffffff' };
      case 'S8': return { bg: '#55a822', fg: '#ffffff' };
      case 'S85': return { bg: '#55a822', fg: '#ffffff' };
      case 'S9': return { bg: '#8b1c52', fg: '#ffffff' };
      default: return { bg: '#00965e', fg: '#ffffff' };
    }
  }
  
  // U-Bahn
  if (clean.startsWith('U') && (clean === 'U' || /^[U]\d+/.test(clean))) {
    switch (clean) {
      case 'U1': return { bg: '#7aab55', fg: '#ffffff' };
      case 'U2': return { bg: '#da421e', fg: '#ffffff' };
      case 'U3': return { bg: '#009f65', fg: '#ffffff' };
      case 'U4': return { bg: '#fcd227', fg: '#000000' };
      case 'U5': return { bg: '#a06540', fg: '#ffffff' };
      case 'U6': return { bg: '#69829b', fg: '#ffffff' };
      case 'U7': return { bg: '#528dba', fg: '#ffffff' };
      case 'U8': return { bg: '#224f8a', fg: '#ffffff' };
      case 'U9': return { bg: '#ffa812', fg: '#ffffff' };
      default: return { bg: '#005a9c', fg: '#ffffff' };
    }
  }
  
  // MetroTram or MetroBus (starts with M)
  if (clean.startsWith('M') && (clean === 'M' || /^[M]\d+/.test(clean))) {
    const num = parseInt(clean.slice(1));
    const metroTrams = [1, 2, 4, 5, 6, 8, 10, 13, 17];
    if (metroTrams.includes(num)) {
      return { bg: '#d8201b', fg: '#ffffff' }; // MetroTram Red
    } else {
      return { bg: '#963f94', fg: '#ffffff' }; // MetroBus Purple
    }
  }
  
  // Express Bus
  if (clean.startsWith('X')) {
    return { bg: '#963f94', fg: '#ffffff' }; // Bus purple
  }
  
  // Regional Train
  if (clean.startsWith('RE') || clean.startsWith('RB')) {
    return { bg: '#b02c26', fg: '#ffffff' }; // Regional red
  }
  
  return { bg: '#6366f1', fg: '#ffffff' };
};
