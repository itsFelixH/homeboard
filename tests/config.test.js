const fs = require('fs');
const path = require('path');

describe('ConfigLoader & getTransitLineStyle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    HOMEBOARD_CONFIG = {};
    global.resetDOM();
    jest.restoreAllMocks();
  });

  test('loads valid YAML configuration successfully', async () => {
    const yamlSample = fs.readFileSync(path.join(__dirname, 'fixtures/config.sample.yaml'), 'utf8');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => yamlSample
    });

    await ConfigLoader.load();

    expect(HOMEBOARD_CONFIG).toBeDefined();
    expect(HOMEBOARD_CONFIG.location.latitude).toBe(52.52);
    expect(HOMEBOARD_CONFIG.greeting.name).toBe('Felix');
    expect(HOMEBOARD_CONFIG.weather.units).toBe('celsius');
    expect(HOMEBOARD_CONFIG.weather.refreshMinutes).toBe(15);
    expect(HOMEBOARD_CONFIG.birthdays.lookaheadDays).toBe(14);
    expect(HOMEBOARD_CONFIG.cards.departures.showDelays).toBe(true);
  });

  test('falls back to config.template.yaml if config.local.yaml fails', async () => {
    const yamlSample = fs.readFileSync(path.join(__dirname, 'fixtures/config.sample.yaml'), 'utf8');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, text: async () => yamlSample });

    await ConfigLoader.load();

    expect(HOMEBOARD_CONFIG.location.latitude).toBe(52.52);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('uses sessionStorage cache if version matches', async () => {
    const yamlSample = fs.readFileSync(path.join(__dirname, 'fixtures/config.sample.yaml'), 'utf8');
    sessionStorage.setItem('homeboard_config_cache', JSON.stringify({
      version: 4,
      text: yamlSample
    }));

    global.fetch = jest.fn();

    await ConfigLoader.load();

    expect(HOMEBOARD_CONFIG.greeting.name).toBe('Felix');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('renders error overlay when config fails to load', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await ConfigLoader.load();

    const dashboard = document.querySelector('.dashboard');
    expect(dashboard.innerHTML).toContain('Config not found');
    consoleSpy.mockRestore();
  });

  test('getTransitLineStyle returns appropriate colors for S-Bahn, U-Bahn, Bus, Tram', () => {
    expect(window.getTransitLineStyle('S7')).toEqual({ bg: '#6f4e9c', fg: '#ffffff' });
    expect(window.getTransitLineStyle('S1')).toEqual({ bg: '#de4da5', fg: '#ffffff' });
    expect(window.getTransitLineStyle('U2')).toEqual({ bg: '#da421e', fg: '#ffffff' });
    expect(window.getTransitLineStyle('U4')).toEqual({ bg: '#fcd227', fg: '#000000' });
    expect(window.getTransitLineStyle('M10')).toEqual({ bg: '#d8201b', fg: '#ffffff' });
    expect(window.getTransitLineStyle('M41')).toEqual({ bg: '#963f94', fg: '#ffffff' });
    expect(window.getTransitLineStyle('X9')).toEqual({ bg: '#963f94', fg: '#ffffff' });
    expect(window.getTransitLineStyle('RE1')).toEqual({ bg: '#b02c26', fg: '#ffffff' });
    expect(window.getTransitLineStyle('')).toEqual({ bg: '#6366f1', fg: '#ffffff' });
    expect(window.getTransitLineStyle('UNKNOWN')).toEqual({ bg: '#6366f1', fg: '#ffffff' });
  });
});
