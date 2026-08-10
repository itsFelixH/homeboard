/**
 * Homeboard - App initializer
 *
 * Card ordering, visibility, and per-card settings are controlled via
 * HOMEBOARD_CONFIG.cards (loaded from config.local.yaml).
 * The key order determines display order; each entry can set { enabled: false }
 * to hide the card and include arbitrary settings that the module can read.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Load YAML config before anything else
  await ConfigLoader.load();

  // Load themes from YAML files
  await Themes.load();

  Theme.init();
  Lang.init();

  // --- Card registry: maps card id → CSS class suffix + init function(s) ---
  const CARD_REGISTRY = {
    weather:    { className: 'card-weather',    init: () => { Weather.init(); Sun.init(); Moon.init(); } },
    rain:       { className: 'card-rain',       init: () => Rain.init() },
    departures: { className: 'card-departures', init: () => Departures.init() },
    commute:    { className: 'card-commute',    init: () => Commute.init() },
    aqi:        { className: 'card-aqi',        init: () => AirQuality.init() },
    uv:         { className: 'card-uv',         init: () => UV.init() },
    pollen:     { className: 'card-pollen',     init: () => Pollen.init() },
    plants:     { className: 'card-plants',     init: () => Plants.init() },
    calendar:   { className: 'card-calendar',   init: () => Calendar.init() },
    birthdays:  { className: 'card-birthdays',  init: () => Birthdays.init() },
    countdown:  { className: 'card-countdown',  init: () => Holiday.init() },
    news:       { className: 'card-news',       init: () => News.init() },
    word:       { className: 'card-word',       init: () => Word.init() },
    spell:      { className: 'card-spell',      init: () => Hogwarts.init() },
    history:    { className: 'card-history',     init: () => History.init() },
    trash:      { className: 'card-trash',      init: () => Trash.init() },
    github:     { className: 'card-github',     init: () => GitHub.init() },
    xkcd:       { className: 'card-xkcd',       init: () => XKCD.init() },
    packages:   { className: 'card-packages',   init: () => Packages.init() },
    email:      { className: 'card-email',      init: () => Email.init() },
    slideshow:  { className: 'card-slideshow',  init: () => Slideshow.init() }
  };

  // Default card order (used when config.cards is not defined)
  const DEFAULT_ORDER = Object.keys(CARD_REGISTRY);

  // Resolve card list: use config order if defined, otherwise default
  const cardsConfig = (HOMEBOARD_CONFIG && HOMEBOARD_CONFIG.cards) || {};
  const configKeys = Object.keys(cardsConfig);
  const cardOrder = configKeys.length > 0 ? configKeys : DEFAULT_ORDER;

  // --- Reorder and toggle card visibility ---
  const dashboard = document.querySelector('.dashboard');
  const topbar = dashboard.querySelector('.topbar');

  cardOrder.forEach(id => {
    const reg = CARD_REGISTRY[id];
    if (!reg) return; // unknown card id, skip

    const cardEl = dashboard.querySelector(`.${reg.className}`);
    if (!cardEl) return;

    const settings = cardsConfig[id] || {};
    const enabled = settings.enabled !== false; // default to true

    if (enabled) {
      // Move card to end of dashboard (preserves config order)
      dashboard.appendChild(cardEl);
    } else {
      // Hide disabled cards
      cardEl.style.display = 'none';
    }
  });

  // Hide any cards not listed in config (if config is defined)
  if (configKeys.length > 0) {
    Object.keys(CARD_REGISTRY).forEach(id => {
      if (!cardsConfig[id]) {
        const reg = CARD_REGISTRY[id];
        const cardEl = dashboard.querySelector(`.${reg.className}`);
        if (cardEl) cardEl.style.display = 'none';
      }
    });
  }

  // Translate all [data-i18n] elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = i18n(key);
    if (translated && translated !== key) {
      el.textContent = translated;
    }
  });

  // Timeout: replace any remaining "Loading..." after 15 seconds
  setTimeout(() => {
    document.querySelectorAll('.event-placeholder, .birthday-none, .countdown-empty, .departures-empty, .commute-empty').forEach(el => {
      if (el.textContent === 'Loading...') {
        el.textContent = '--';
      }
    });
  }, 15000);

  // --- Initialize modules (only for enabled cards) ---
  // Always-on utility modules (no visible card)
  Clock.init();

  // Initialize each enabled card's module(s)
  cardOrder.forEach(id => {
    const reg = CARD_REGISTRY[id];
    if (!reg) return;

    const settings = cardsConfig[id] || {};
    if (settings.enabled === false) return;

    try {
      reg.init();
    } catch (err) {
      console.error(`[Homeboard] Failed to init card "${id}":`, err);
    }
  });
});
