describe('Themes & Theme', () => {
  beforeEach(() => {
    localStorage.clear();
    global.resetDOM();
    jest.restoreAllMocks();
  });

  test('falls back to default dark theme when index.yaml cannot be fetched', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockRejectedValue(new Error('File not found'));

    await Themes.load();

    expect(Themes.all().dark).toBeDefined();
    expect(Themes.all().dark.colors.bg).toBe('#09090b');
    consoleSpy.mockRestore();
  });

  test('loads themes from index.yaml and applies custom CSS variables to documentElement', async () => {
    localStorage.setItem('homeboard_theme', 'nord');

    global.fetch = jest.fn((url) => {
      if (url === 'themes/index.yaml') {
        return Promise.resolve({
          ok: true,
          text: async () => 'themes:\n  - dark\n  - nord\n  - pixel\n'
        });
      }
      if (url === 'themes/nord.yaml') {
        return Promise.resolve({
          ok: true,
          text: async () => 'name: Nord\nicon: "❄️"\ncolors:\n  bg: "#2e3440"\n  surface: "#3b4252"\n  border: "#4c566a"\n  text: "#eceff4"\n'
        });
      }
      return Promise.resolve({
        ok: true,
        text: async () => 'name: Dark\nicon: "🌙"\ncolors:\n  bg: "#09090b"\n  surface: "#18181b"\n  border: "#27272a"\n  text: "#fafafa"\n'
      });
    });

    await Themes.load();
    Themes.apply('nord');

    expect(Themes.current()).toBe('nord');
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#2e3440');
    expect(document.documentElement.style.getPropertyValue('--surface')).toBe('#3b4252');
  });

  test('loads all registered themes so all modes are available in the mode selector menu', async () => {
    global.fetch = jest.fn((url) => {
      if (url === 'themes/index.yaml') {
        return Promise.resolve({
          ok: true,
          text: async () => 'themes:\n  - dark\n  - light\n  - nord\n  - pixel\n'
        });
      }
      if (url === 'themes/light.yaml') {
        return Promise.resolve({
          ok: true,
          text: async () => 'name: Light\nicon: "☀️"\ncolors:\n  bg: "#f8fafc"\n  surface: "#ffffff"\n  border: "#e2e8f0"\n  text: "#0f172a"\n'
        });
      }
      if (url === 'themes/nord.yaml') {
        return Promise.resolve({
          ok: true,
          text: async () => 'name: Nord\nicon: "❄️"\ncolors:\n  bg: "#2e3440"\n  surface: "#3b4252"\n  border: "#4c566a"\n  text: "#eceff4"\n'
        });
      }
      if (url === 'themes/pixel.yaml') {
        return Promise.resolve({
          ok: true,
          text: async () => 'name: Pixel\nicon: "👾"\ncolors:\n  bg: "#0a0a1a"\n  surface: "#111128"\n  border: "#2a2a4a"\n  text: "#e0e8ff"\n'
        });
      }
      return Promise.resolve({
        ok: true,
        text: async () => 'name: Dark\nicon: "🌙"\ncolors:\n  bg: "#09090b"\n  surface: "#18181b"\n  border: "#27272a"\n  text: "#fafafa"\n'
      });
    });

    await Themes.load();
    Theme.init();

    const menu = document.getElementById('theme-menu');
    const buttons = menu.querySelectorAll('button');

    // All 4 themes should be present in the dropdown menu
    expect(buttons.length).toBe(4);
    const themeValues = Array.from(buttons).map(b => b.getAttribute('data-value'));
    expect(themeValues).toEqual(['dark', 'light', 'nord', 'pixel']);

    // Switch to Light mode
    const lightBtn = menu.querySelector('button[data-value="light"]');
    lightBtn.click();
    expect(Themes.current()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#f8fafc');
    expect(localStorage.getItem('homeboard_theme')).toBe('light');

    // Switch to Pixel mode
    const pixelBtn = menu.querySelector('button[data-value="pixel"]');
    pixelBtn.click();
    expect(Themes.current()).toBe('pixel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('pixel');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#0a0a1a');
  });

  test('Theme.init handles dropdown toggling and persists selection', async () => {
    Themes.apply('dark');
    Theme.init();

    const btn = document.getElementById('theme-btn');
    const menu = document.getElementById('theme-menu');
    expect(btn).not.toBeNull();
    expect(menu).not.toBeNull();

    // Trigger open
    btn.click();
    expect(menu.classList.contains('open')).toBe(true);

    // Click outside closes menu
    document.dispatchEvent(new MouseEvent('click'));
    expect(menu.classList.contains('open')).toBe(false);
  });
});
