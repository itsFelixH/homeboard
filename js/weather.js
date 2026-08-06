/**
 * Weather module - fetches current weather from OpenWeatherMap
 */
const Weather = (() => {
  const WEATHER_ICONS = {
    '01d': '\u2600\uFE0F', '01n': '\uD83C\uDF19',
    '02d': '\u26C5', '02n': '\u26C5',
    '03d': '\u2601\uFE0F', '03n': '\u2601\uFE0F',
    '04d': '\u2601\uFE0F', '04n': '\u2601\uFE0F',
    '09d': '\uD83C\uDF27\uFE0F', '09n': '\uD83C\uDF27\uFE0F',
    '10d': '\uD83C\uDF26\uFE0F', '10n': '\uD83C\uDF27\uFE0F',
    '11d': '\u26C8\uFE0F', '11n': '\u26C8\uFE0F',
    '13d': '\u2744\uFE0F', '13n': '\u2744\uFE0F',
    '50d': '\uD83C\uDF2B\uFE0F', '50n': '\uD83C\uDF2B\uFE0F'
  };

  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.weather;
    if (!config.apiKey || !config.city) {
      document.getElementById('weather-desc').textContent = 'Configure API key in config.js';
      return;
    }
    fetch_weather();
    refreshInterval = setInterval(fetch_weather, config.refreshMinutes * 60 * 1000);
  }

  async function fetch_weather() {
    const config = HOMEBOARD_CONFIG.weather;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(config.city)}&units=${config.units}&appid=${config.apiKey}`;

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
    const icon = data.weather[0].icon;
    const unitSymbol = HOMEBOARD_CONFIG.weather.units === 'imperial' ? 'F' : 'C';

    document.getElementById('weather-icon').textContent = WEATHER_ICONS[icon] || '\u2600\uFE0F';
    document.getElementById('weather-temp').textContent = `${Math.round(data.main.temp)}\u00B0${unitSymbol}`;
    document.getElementById('weather-desc').textContent = data.weather[0].description;
    document.getElementById('weather-humidity').textContent = `Humidity: ${data.main.humidity}%`;
    document.getElementById('weather-wind').textContent = `Wind: ${Math.round(data.wind.speed)} km/h`;
  }

  return { init };
})();
