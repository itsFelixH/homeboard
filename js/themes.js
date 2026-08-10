/**
 * Theme loader — data-driven themes from YAML files in themes/
 *
 * Reads themes/index.yaml for the list of available themes,
 * loads each theme's YAML, and applies CSS custom properties + settings.
 *
 * Theme YAML structure:
 *   name: Display Name
 *   icon: "🎨"
 *   colors:
 *     bg: "#09090b"
 *     surface: "#18181b"
 *     ...
 *   style:
 *     font: "'Inter', sans-serif"
 *     monoFont: "'JetBrains Mono', monospace"
 *     radius: "14px"
 *     gap: "12px"
 *     cardShadow: "none"
 *     cardBorder: true
 *     headerWeight: "600"
 *     animation: true
 *     textShadow: "none"
 */
const Themes = (() => {
  let _themes = {}; // id -> { name, icon, colors, style }
  let _current = 'dark';
  let _ready = false;
  const _onReady = [];

  // Defaults for style settings (used when theme doesn't specify them)
  const STYLE_DEFAULTS = {
    font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    monoFont: "'JetBrains Mono', monospace",
    radius: '14px',
    gap: '12px',
    cardShadow: 'none',
    cardBorder: true,
    headerWeight: '600',
    animation: true,
    textShadow: 'none'
  };

  /** Load all themes from server */
  async function load() {
    try {
      const indexRes = await fetch('themes/index.yaml');
      if (!indexRes.ok) throw new Error('themes/index.yaml not found');
      const indexData = jsyaml.load(await indexRes.text());
      const themeIds = indexData.themes || [];

      const results = await Promise.all(
        themeIds.map(async (id) => {
          try {
            const res = await fetch(`themes/${id}.yaml`);
            if (!res.ok) return null;
            const data = jsyaml.load(await res.text());
            return { id, ...data };
          } catch (e) {
            console.warn(`[Themes] Failed to load theme "${id}":`, e);
            return null;
          }
        })
      );

      for (const theme of results) {
        if (theme && theme.colors) {
          _themes[theme.id] = {
            name: theme.name || theme.id,
            icon: theme.icon || '🎨',
            colors: theme.colors,
            style: { ...STYLE_DEFAULTS, ...(theme.style || {}) }
          };
          // Legacy: support top-level "font" key
          if (theme.font && !theme.style?.font) {
            _themes[theme.id].style.font = theme.font;
          }
        }
      }
    } catch (e) {
      console.error('[Themes] Failed to load theme index:', e);
      _themes.dark = {
        name: 'Dark', icon: '🌙',
        colors: {
          bg: '#09090b', surface: '#18181b', 'surface-hover': '#1f1f23',
          border: '#27272a', text: '#fafafa', 'text-2': '#a1a1aa',
          'text-3': '#71717a', accent: '#6366f1', 'accent-dim': '#6366f120',
          cyan: '#06b6d4', green: '#10b981', amber: '#f59e0b', red: '#ef4444'
        },
        style: { ...STYLE_DEFAULTS }
      };
    }

    _ready = true;
    _onReady.forEach(fn => fn());
  }

  /** Apply a theme by id */
  function apply(id) {
    const theme = _themes[id] || _themes.dark || Object.values(_themes)[0];
    if (!theme) return;

    _current = id;
    const root = document.documentElement;

    // Apply color variables
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(`--${key}`, value);
    }

    // Apply style settings as CSS variables
    const s = theme.style;
    root.style.setProperty('--radius', s.radius);
    root.style.setProperty('--gap', s.gap);
    root.style.setProperty('--card-shadow', s.cardShadow);
    root.style.setProperty('--card-border-width', s.cardBorder ? '1px' : '0');
    root.style.setProperty('--header-weight', s.headerWeight);
    root.style.setProperty('--text-shadow', s.textShadow);
    root.style.setProperty('--theme-font', s.font);
    root.style.setProperty('--mono-font', s.monoFont);

    // Apply font to body
    document.body.style.fontFamily = s.font;

    // Animation toggle
    if (!s.animation) {
      root.style.setProperty('--transition', 'none');
      root.style.setProperty('--hover-transform', 'none');
    } else {
      root.style.setProperty('--transition', 'background 0.2s, border-color 0.2s, transform 0.15s');
      root.style.setProperty('--hover-transform', 'translateY(-1px)');
    }

    // Set data-theme attribute for CSS-only overrides (pixel font sizes, etc.)
    root.setAttribute('data-theme', id);
  }

  /** Get current theme id */
  function current() {
    return _current;
  }

  /** Get all loaded themes */
  function all() {
    return _themes;
  }

  /** Register a callback for when themes finish loading */
  function onReady(fn) {
    if (_ready) fn();
    else _onReady.push(fn);
  }

  return { load, apply, current, all, onReady };
})();
