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
