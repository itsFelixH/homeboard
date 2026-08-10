/**
 * Homeboard - YAML Config Loader
 *
 * Fetches config.local.yaml (falls back to config.template.yaml),
 * parses it with js-yaml, and exposes it as the global HOMEBOARD_CONFIG.
 * Also merges per-card settings into the legacy module config structure
 * so existing modules work without changes.
 *
 * This script must be loaded AFTER js-yaml and BEFORE all other modules.
 * It blocks rendering until config is ready (DOMContentLoaded won't fire until
 * the deferred init script runs).
 */

// Global config object — modules read from this
let HOMEBOARD_CONFIG = {};

const ConfigLoader = (() => {
  async function load() {
    let yamlText = null;

    // Try config.local.yaml first, fall back to template
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

    if (!yamlText) {
      console.error('[Homeboard] No config file found');
      return;
    }

    // Parse YAML
    const raw = jsyaml.load(yamlText);
    if (!raw || typeof raw !== 'object') {
      console.error('[Homeboard] Invalid config YAML');
      return;
    }

    // Build the HOMEBOARD_CONFIG object with backward-compatible structure
    HOMEBOARD_CONFIG = buildConfig(raw);
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
    config.location = raw.location || { latitude: 0, longitude: 0 };

    // --- Greeting ---
    config.greeting = raw.greeting || {};

    // --- Weather: merge card settings with legacy structure ---
    config.weather = {
      units: cards.weather?.units || 'celsius',
      refreshMinutes: cards.weather?.refreshMinutes || 15,
      showClothing: cards.weather?.showClothing !== false,
      showForecast: cards.weather?.showForecast !== false,
      forecastDays: cards.weather?.forecastDays || 4
    };

    // --- Rain ---
    config.rain = {
      refreshMinutes: cards.rain?.refreshMinutes || 15,
      forecastHours: cards.rain?.forecastHours || 12
    };

    // --- Commute: merge card settings + dedicated section ---
    // Default origin to location if not explicitly set
    const commuteSection = raw.commute || {};
    const commuteOrigin = commuteSection.origin
      && (commuteSection.origin.latitude || commuteSection.origin.longitude)
      ? commuteSection.origin
      : config.location;
    config.commute = {
      origin: commuteOrigin,
      destinations: commuteSection.destinations || [],
      refreshMinutes: cards.commute?.refreshMinutes || 10,
      showBike: cards.commute?.showBike !== false,
      showTransit: cards.commute?.showTransit !== false,
      bikeSpeedFactor: cards.commute?.bikeSpeedFactor || 1.5
    };

    // --- Calendar: merge card settings + dedicated section ---
    const calSection = raw.calendar || {};
    config.calendar = {
      icsUrl: calSection.icsUrl || '',
      maxEvents: cards.calendar?.maxEvents || 5,
      refreshMinutes: cards.calendar?.refreshMinutes || 30,
      showTomorrow: cards.calendar?.showTomorrow !== false,
      showCommute: cards.calendar?.showCommute !== false,
      hidePatterns: cards.calendar?.hidePatterns || []
    };

    // --- Birthdays ---
    const bdaySection = raw.birthdays || {};
    config.birthdays = {
      icsUrl: bdaySection.icsUrl || '',
      refreshMinutes: cards.birthdays?.refreshMinutes || 60,
      lookaheadDays: cards.birthdays?.lookaheadDays || 7
    };

    // --- Slideshow ---
    const slideSection = raw.slideshow || {};
    config.slideshow = {
      images: slideSection.images || [],
      intervalSeconds: cards.slideshow?.intervalSeconds || 30
    };

    // --- Departures: merge card settings + dedicated section ---
    const depSection = raw.departures || {};
    config.departures = {
      stopId: depSection.stopId || '',
      stops: depSection.stops || [],
      durationMinutes: cards.departures?.durationMinutes || 30,
      maxResults: cards.departures?.maxResults || 5,
      refreshSeconds: cards.departures?.refreshSeconds || 30,
      hafasAccessId: depSection.hafasAccessId || ''
    };

    // --- Countdown ---
    const countdownSection = raw.countdown || {};
    config.countdown = {
      date: countdownSection.date || '',
      label: countdownSection.label || 'Vacation',
      names: countdownSection.names || {},
      maxVacations: cards.countdown?.maxVacations || 3,
      keyword: cards.countdown?.keyword || 'Urlaub'
    };

    // --- Trash ---
    const trashSection = raw.trash || {};
    config.trash = {
      icsUrl: trashSection.icsUrl || '',
      refreshHours: cards.trash?.refreshHours || 6,
      previewDays: cards.trash?.previewDays || 7
    };

    // --- Packages ---
    const pkgSection = raw.packages || {};
    config.packages = {
      dhlApiKey: pkgSection.dhlApiKey || '',
      refreshMinutes: cards.packages?.refreshMinutes || 30
    };

    // --- GitHub ---
    const ghSection = raw.github || {};
    config.github = {
      username: ghSection.username || '',
      refreshMinutes: cards.github?.refreshMinutes || 30,
      maxEvents: cards.github?.maxEvents || 4
    };

    // --- Email ---
    const emailSection = raw.email || {};
    config.email = {
      address: emailSection.address || '',
      appPassword: emailSection.appPassword || '',
      refreshMinutes: cards.email?.refreshMinutes || 5
    };

    // --- AQI ---
    config.aqi = {
      refreshMinutes: cards.aqi?.refreshMinutes || 30
    };

    // --- UV ---
    config.uv = {
      refreshMinutes: cards.uv?.refreshMinutes || 30
    };

    // --- Pollen ---
    config.pollen = {
      refreshMinutes: cards.pollen?.refreshMinutes || 60,
      types: cards.pollen?.types || []
    };

    // --- Plants ---
    config.plants = {
      warningDays: cards.plants?.warningDays || 7
    };

    // --- News ---
    config.news = {
      refreshMinutes: cards.news?.refreshMinutes || 10,
      perPage: cards.news?.perPage || 5,
      cycleSeconds: cards.news?.cycleSeconds || 30,
      defaultCategory: cards.news?.defaultCategory || 'homepage'
    };

    // --- Word ---
    config.word = {};

    // --- Spell (Harry Potter) ---
    config.spell = {
      cycleSeconds: cards.spell?.cycleSeconds || 60
    };

    // --- History ---
    config.history = {
      minYear: cards.history?.minYear || 1500
    };

    // --- XKCD ---
    config.xkcd = {};

    return config;
  }

  return { load };
})();
