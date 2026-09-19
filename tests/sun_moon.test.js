describe('Sun & Moon Modules', () => {
  beforeEach(() => {
    global.resetDOM();
    HOMEBOARD_CONFIG = {
      location: { latitude: 52.52, longitude: 13.405 }
    };
    jest.restoreAllMocks();
  });

  test('Sun.init fetches and renders sunrise and sunset times', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          sunrise: ['2026-09-19T06:45'],
          sunset: ['2026-09-19T19:15']
        }
      })
    });

    Sun.init();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const sunriseEl = document.getElementById('sunrise-time');
    const sunsetEl = document.getElementById('sunset-time');

    expect(sunriseEl.textContent).toMatch(/\d{2}:\d{2}/);
    expect(sunsetEl.textContent).toMatch(/\d{2}:\d{2}/);
  });

  test('Sun.init displays placeholder when location is missing', () => {
    HOMEBOARD_CONFIG = { location: {} };
    Sun.init();

    expect(document.getElementById('sunrise-time').textContent).toBe('--:--');
    expect(document.getElementById('sunset-time').textContent).toBe('--:--');
  });

  test('Moon.init calculates and renders moon phase icon', () => {
    Moon.init();
    const moonEl = document.getElementById('moon-phase');
    expect(moonEl).not.toBeNull();
    expect(moonEl.innerHTML).toContain('title=');
  });
});
