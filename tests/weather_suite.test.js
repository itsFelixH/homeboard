const fs = require('fs');
const path = require('path');

describe('Weather Suite (Weather, Rain, AirQuality, UV, Pollen)', () => {
  beforeEach(() => {
    global.resetDOM();
    HOMEBOARD_CONFIG = {
      location: { latitude: 52.52, longitude: 13.405 },
      weather: {
        units: 'celsius',
        refreshMinutes: 15,
        showClothing: true,
        showForecast: true,
        forecastDays: 4
      },
      rain: {
        refreshMinutes: 15,
        forecastHours: 12
      },
      aqi: { refreshMinutes: 30 },
      uv: { refreshMinutes: 30 },
      pollen: { refreshMinutes: 60, types: [] }
    };
    jest.restoreAllMocks();
  });

  test('Weather.init fetches forecast and updates current temp and forecast row', async () => {
    const weatherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/weather_openmeteo.json'), 'utf8'));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => weatherData
    });

    Weather.init();
    await new Promise(r => setTimeout(r, 50));

    const tempEl = document.getElementById('weather-temp');
    expect(tempEl.textContent).toContain('19');
    const forecastEl = document.getElementById('weather-forecast');
    expect(forecastEl.innerHTML.length).toBeGreaterThan(0);
  });

  test('Rain.init renders precipitation probability bars', async () => {
    const weatherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/weather_openmeteo.json'), 'utf8'));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => weatherData
    });

    // Set mock time within fixture range (2026-09-19T05:00)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-19T05:00:00'));

    Rain.init();
    await Promise.resolve();
    await Promise.resolve();

    const rainBars = document.getElementById('rain-bars');
    expect(rainBars.innerHTML).toContain('rain-bar');

    jest.useRealTimers();
  });

  test('AirQuality.init transforms European AQI and updates air quality indicator', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          european_aqi: 25,
          pm2_5: 8.2,
          pm10: 14.5
        }
      })
    });

    AirQuality.init();
    await new Promise(r => setTimeout(r, 50));

    const aqiVal = document.getElementById('aqi-value');
    expect(aqiVal.textContent).toBe('25');
  });

  test('UV.init fetches current UV index and assigns severity label', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        now: {
          uvi: 5.8
        }
      })
    });

    UV.init();
    await new Promise(r => setTimeout(r, 50));

    const uvVal = document.getElementById('uv-value');
    expect(uvVal.textContent).toBe('5.8');
    const uvLabel = document.getElementById('uv-label');
    expect(uvLabel.textContent).toBe('High');
  });

  test('Pollen.init renders pollen indicator levels', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          alder_pollen: 0.5,
          birch_pollen: 1.2,
          grass_pollen: 0.1,
          mugwort_pollen: 0.0,
          olive_pollen: 0.0,
          ragweed_pollen: 0.0
        }
      })
    });

    Pollen.init();
    await new Promise(r => setTimeout(r, 50));

    const pollenEl = document.getElementById('pollen-list');
    expect(pollenEl.innerHTML).toContain('pollen-item');
  });
});
