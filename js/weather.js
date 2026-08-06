/**
 * Weather module - fetches current weather from Open-Meteo (no API key needed)
 * https://open-meteo.com/
 */
const Weather = (() => {
  // WMO Weather interpretation codes -> emoji
  const WMO_ICONS = {
    0: '\u2600\uFE0F',       // Clear sky
    1: '\uD83C\uDF24\uFE0F', // Mainly clear
    2: '\u26C5',             // Partly cloudy
    3: '\u2601\uFE0F',       // Overcast
    45: '\uD83C\uDF2B\uFE0F', // Fog
    48: '\uD83C\uDF2B\uFE0F', // Depositing rime fog
    51: '\uD83C\uDF26\uFE0F', // Light drizzle
    53: '\uD83C\uDF26\uFE0F', // Moderate drizzle
    55: '\uD83C\uDF27\uFE0F', // Dense drizzle
    61: '\uD83C\uDF27\uFE0F', // Slight rain
    63: '\uD83C\uDF27\uFE0F', // Moderate rain
    65: '\uD83C\uDF27\uFE0F', // Heavy rain
    71: '\u2744\uFE0F',       // Slight snowfall
    73: '\u2744\uFE0F',       // Moderate snowfall
    75: '\u2744\uFE0F',       // Heavy snowfall
    77: '\u2744\uFE0F',       // Snow grains
    80: '\uD83C\uDF26\uFE0F', // Slight rain showers
    81: '\uD83C\uDF27\uFE0F', // Moderate rain showers
    82: '\uD83C\uDF27\uFE0F', // Violent rain showers
    85: '\u2744\uFE0F',       // Slight snow showers
    86: '\u2744\uFE0F',       // Heavy snow showers
    95: '\u26C8\uFE0F',       // Thunderstorm
    96: '\u26C8\uFE0F',       // Thunderstorm with slight hail
    99: '\u26C8\uFE0F'        // Thunderstorm with heavy hail
  };

  const WMO_DESCRIPTIONS = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
    85: 'Light snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm'
  };

  let refreshInterval;

  function init() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    if (!latitude || !longitude) {
      document.getElementById('weather-desc').textContent = 'Set location in config.js';
      return;
    }
    fetchWeather();
    refreshInterval = setInterval(fetchWeather, HOMEBOARD_CONFIG.weather.refreshMinutes * 60 * 1000);
  }

  async function fetchWeather() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    const tempUnit = HOMEBOARD_CONFIG.weather.units === 'fahrenheit' ? 'fahrenheit' : 'celsius';

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=${tempUnit}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      console.error('Weather fetch failed:', err);
      document.getElementById('weather-desc').textContent = 'Failed to load weather';
    }
  }

  function render(data) {
    const current = data.current;
    const code = current.weather_code;
    const unitSymbol = HOMEBOARD_CONFIG.weather.units === 'fahrenheit' ? 'F' : 'C';

    document.getElementById('weather-icon').textContent = WMO_ICONS[code] || '\u2600\uFE0F';
    document.getElementById('weather-temp').textContent = `${Math.round(current.temperature_2m)}\u00B0${unitSymbol}`;
    document.getElementById('weather-desc').textContent = WMO_DESCRIPTIONS[code] || 'Unknown';
    document.getElementById('weather-humidity').textContent = `Humidity: ${current.relative_humidity_2m}%`;
    document.getElementById('weather-wind').textContent = `Wind: ${Math.round(current.wind_speed_10m)} km/h`;
  }

  return { init };
})();
