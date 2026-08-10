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
 *     bg, surface, surface-hover, border
 *     text, text-muted, text-faint
 *     accent, accent-dim, highlight
 *     ok, warning, danger
 *   style:
 *     font, radius, spacing, shadow
 *     borders, header-weight, transitions, glow
 */
const Themes = (() => {
  let _themes = {};
  let _current = 'dark';
  let _ready = false;
  const _onReady = [];

  const STYLE_DEFAULTS = {
    font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    radius: '14px',
    spacing: '12px',
    shadow: 'none',
    borders: true,
    'header-weight': '600',
    transitions: true,
    glow: 'none'
  };

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
        }
      }
    } catch (e) {
      console.error('[Themes] Failed to load theme index:', e);
      _themes.dark = {
        name: 'Dark', icon: '🌙',
        colors: {
          bg: '#09090b', surface: '#18181b', 'surface-hover': '#1f1f23',
          border: '#27272a', text: '#fafafa', 'text-muted': '#a1a1aa',
          'text-faint': '#71717a', accent: '#a78bfa', 'accent-dim': '#a78bfa12',
          highlight: '#a78bfa', ok: '#a78bfa', warning: '#a78bfaaa', danger: '#f87171'
        },
        style: { ...STYLE_DEFAULTS }
      };
    }

    _ready = true;
    _onReady.forEach(fn => fn());
  }

  function apply(id) {
    const theme = _themes[id] || _themes.dark || Object.values(_themes)[0];
    if (!theme) return;

    _current = id;
    const root = document.documentElement;

    // Apply color variables (maps YAML names to CSS --vars)
    // Also set legacy aliases so existing CSS rules still work
    const colors = theme.colors;
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--${key}`, value);
    }
    // Legacy aliases (CSS still uses --text-2, --text-3, --cyan, --green, --amber, --red, --gap)
    if (colors['text-muted']) root.style.setProperty('--text-2', colors['text-muted']);
    if (colors['text-faint']) root.style.setProperty('--text-3', colors['text-faint']);
    if (colors['highlight']) root.style.setProperty('--cyan', colors['highlight']);
    if (colors['ok']) root.style.setProperty('--green', colors['ok']);
    if (colors['warning']) root.style.setProperty('--amber', colors['warning']);
    if (colors['danger']) root.style.setProperty('--red', colors['danger']);

    // Apply style settings
    const s = theme.style;
    root.style.setProperty('--radius', s.radius);
    root.style.setProperty('--gap', s.spacing);
    root.style.setProperty('--card-shadow', s.shadow);
    root.style.setProperty('--card-border-width', s.borders ? '1px' : '0');
    root.style.setProperty('--header-weight', s['header-weight']);
    root.style.setProperty('--text-shadow', s.glow);

    // Apply font to body
    document.body.style.fontFamily = s.font;

    // Transitions toggle
    if (!s.transitions) {
      root.style.setProperty('--transition', 'none');
      root.style.setProperty('--hover-transform', 'none');
    } else {
      root.style.setProperty('--transition', 'background 0.2s, border-color 0.2s, transform 0.15s');
      root.style.setProperty('--hover-transform', 'translateY(-1px)');
    }

    // Set data-theme attribute for CSS-only overrides (pixel font sizes, etc.)
    root.setAttribute('data-theme', id);
  }

  function current() {
    return _current;
  }

  function all() {
    return _themes;
  }

  function onReady(fn) {
    if (_ready) fn();
    else _onReady.push(fn);
  }

  return { load, apply, current, all, onReady };
})();
