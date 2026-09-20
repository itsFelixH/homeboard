/**
 * Theme loader — data-driven themes from YAML files in themes/
 *
 * Loads all registered themes in parallel so the full mode selector
 * menu is immediately available and themes can be applied instantly.
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

  const DEFAULT_FALLBACK_THEMES = {
    dark: {
      name: 'Dark', icon: '🌙',
      colors: {
        bg: '#09090b', surface: '#18181b', 'surface-hover': '#1f1f23',
        border: '#27272a', text: '#fafafa', 'text-muted': '#a1a1aa',
        'text-faint': '#71717a', accent: '#a78bfa', 'accent-dim': '#a78bfa12',
        highlight: '#a78bfa', ok: '#a78bfa', warning: '#a78bfaaa', danger: '#f87171'
      },
      style: { ...STYLE_DEFAULTS }
    },
    light: {
      name: 'Light', icon: '☀️',
      colors: {
        bg: '#f8fafc', surface: '#ffffff', 'surface-hover': '#f1f5f9',
        border: '#e2e8f0', text: '#0f172a', 'text-muted': '#64748b',
        'text-faint': '#94a3b8', accent: '#4f46e5', 'accent-dim': '#4f46e510',
        highlight: '#4f46e5', ok: '#4f46e5', warning: '#4f46e5aa', danger: '#dc2626'
      },
      style: { ...STYLE_DEFAULTS, shadow: '0 1px 3px rgba(0,0,0,0.08)' }
    },
    nord: {
      name: 'Nord', icon: '❄️',
      colors: {
        bg: '#2e3440', surface: '#3b4252', 'surface-hover': '#434c5e',
        border: '#4c566a', text: '#eceff4', 'text-muted': '#d8dee9',
        'text-faint': '#7b88a1', accent: '#88c0d0', 'accent-dim': '#88c0d020',
        highlight: '#88c0d0', ok: '#a3be8c', warning: '#ebcb8b', danger: '#bf616a'
      },
      style: { ...STYLE_DEFAULTS, radius: '10px', borders: false, 'header-weight': '500', shadow: '0 2px 8px rgba(0,0,0,0.25)' }
    },
    pixel: {
      name: 'Pixel', icon: '👾',
      colors: {
        bg: '#0a0a1a', surface: '#111128', 'surface-hover': '#1a1a3a',
        border: '#2a2a4a', text: '#e0e8ff', 'text-muted': '#8888b0',
        'text-faint': '#5555a0', accent: '#ff4488', 'accent-dim': '#ff448820',
        highlight: '#00ffc8', ok: '#00ffc8', warning: '#ffcc00', danger: '#ff4466'
      },
      style: {
        ...STYLE_DEFAULTS,
        font: "'Press Start 2P', monospace",
        radius: '0px',
        spacing: '8px',
        shadow: '4px 4px 0 var(--border)',
        'header-weight': '400',
        transitions: false,
        glow: '0 0 8px var(--highlight)'
      }
    }
  };

  async function load() {
    try {
      const indexRes = await fetch('themes/index.yaml');
      if (!indexRes.ok) throw new Error('themes/index.yaml not found');
      const indexData = jsyaml.load(await indexRes.text());
      const themeIds = (indexData && Array.isArray(indexData.themes)) ? indexData.themes : ['dark', 'light', 'nord', 'pixel'];

      // Fetch all registered themes in parallel so the full menu is immediately available
      await Promise.all(themeIds.map(async (id) => {
        const theme = await fetchTheme(id);
        if (theme) {
          _themes[id] = theme;
        } else if (DEFAULT_FALLBACK_THEMES[id]) {
          _themes[id] = DEFAULT_FALLBACK_THEMES[id];
        }
      }));

      // Ensure at least default themes are present if none loaded
      if (Object.keys(_themes).length === 0) {
        _themes = { ...DEFAULT_FALLBACK_THEMES };
      }
    } catch (e) {
      console.error('[Themes] Failed to load:', e);
      _themes = { ...DEFAULT_FALLBACK_THEMES };
    }

    _ready = true;
    _onReady.forEach(fn => fn());
  }

  async function fetchTheme(id) {
    try {
      const res = await fetch(`themes/${id}.yaml`);
      if (!res.ok) return null;
      const data = jsyaml.load(await res.text());
      if (!data || !data.colors) return null;
      return {
        name: data.name || id,
        icon: data.icon || '🎨',
        colors: data.colors,
        style: { ...STYLE_DEFAULTS, ...(data.style || {}) }
      };
    } catch (e) {
      console.warn(`[Themes] Failed to load theme "${id}":`, e);
      return null;
    }
  }

  function apply(id) {
    const theme = _themes[id] || _themes.dark || Object.values(_themes)[0];
    if (!theme) return;

    _current = id;
    const root = document.documentElement;

    // Apply color variables + legacy aliases
    const colors = theme.colors;
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--${key}`, value);
    }
    if (colors['text-muted']) root.style.setProperty('--text-2', colors['text-muted']);
    if (colors['text-faint']) root.style.setProperty('--text-3', colors['text-faint']);
    if (colors['highlight']) root.style.setProperty('--cyan', colors['highlight']);
    if (colors['ok']) root.style.setProperty('--green', colors['ok']);
    if (colors['warning']) root.style.setProperty('--amber', colors['warning']);
    if (colors['danger']) root.style.setProperty('--red', colors['danger']);
    if (colors['surface-hover']) root.style.setProperty('--surface-hover', colors['surface-hover']);
    if (colors['accent-dim']) root.style.setProperty('--accent-dim', colors['accent-dim']);

    // Apply style settings
    const s = theme.style;
    root.style.setProperty('--radius', s.radius);
    root.style.setProperty('--gap', s.spacing);
    root.style.setProperty('--card-shadow', s.shadow);
    root.style.setProperty('--card-border-width', s.borders ? '1px' : '0');
    root.style.setProperty('--header-weight', s['header-weight']);
    root.style.setProperty('--text-shadow', s.glow);

    document.body.style.fontFamily = s.font;

    if (!s.transitions) {
      root.style.setProperty('--transition', 'none');
      root.style.setProperty('--hover-transform', 'none');
    } else {
      root.style.setProperty('--transition', 'background 0.2s, border-color 0.2s, transform 0.15s');
      root.style.setProperty('--hover-transform', 'translateY(-1px)');
    }

    root.setAttribute('data-theme', id);
  }

  function current() { return _current; }
  function all() { return _themes; }
  function onReady(fn) { if (_ready) fn(); else _onReady.push(fn); }

  return { load, apply, current, all, onReady };
})();
