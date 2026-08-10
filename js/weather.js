/**
 * Weather module - current weather + daily forecast from Open-Meteo
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
    de: {
      0: 'Klar', 1: 'Überwiegend klar', 2: 'Teilweise bewölkt', 3: 'Bedeckt',
      45: 'Nebel', 48: 'Reifnebel',
      51: 'Leichter Nieselregen', 53: 'Nieselregen', 55: 'Starker Nieselregen',
      61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen',
      71: 'Leichter Schnee', 73: 'Schnee', 75: 'Starker Schnee', 77: 'Schneegriesel',
      80: 'Leichte Schauer', 81: 'Schauer', 82: 'Starke Schauer',
      85: 'Leichte Schneeschauer', 86: 'Starke Schneeschauer',
      95: 'Gewitter', 96: 'Gewitter + Hagel', 99: 'Starkes Gewitter'
    },
    en: {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog', 48: 'Rime fog',
      51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
      61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
      71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
      80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
      85: 'Light snow showers', 86: 'Heavy snow showers',
      95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm'
    },
    es: {
      0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
      45: 'Niebla', 48: 'Niebla helada',
      51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa',
      61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa',
      71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve intensa', 77: 'Granizo fino',
      80: 'Chubascos ligeros', 81: 'Chubascos', 82: 'Chubascos fuertes',
      85: 'Chubascos de nieve', 86: 'Fuertes chubascos de nieve',
      95: 'Tormenta', 96: 'Tormenta + granizo', 99: 'Tormenta severa'
    }
  };

  const DAY_NAMES = {
    de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  };

  let refreshInterval;

  function init() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    if (!latitude || !longitude) {
      document.getElementById('weather-desc').textContent = 'Set location in config';
      return;
    }
    fetchWeather();
    refreshInterval = setInterval(fetchWeather, HOMEBOARD_CONFIG.weather.refreshMinutes * 60 * 1000);
  }

  async function fetchWeather() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    const tempUnit = HOMEBOARD_CONFIG.weather.units === 'fahrenheit' ? 'fahrenheit' : 'celsius';

    const forecastDays = (HOMEBOARD_CONFIG.weather.forecastDays || 4) + 1; // +1 because we skip today
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=${tempUnit}` +
      `&timezone=auto&forecast_days=${forecastDays}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderCurrent(data);
      if (HOMEBOARD_CONFIG.weather.showForecast !== false) {
        renderForecast(data);
      }
    } catch (err) {
      console.error('Weather fetch failed:', err);
      document.getElementById('weather-desc').textContent = 'Failed to load weather';
    }
  }

  function renderCurrent(data) {
    const current = data.current;
    const code = current.weather_code;
    const unitSymbol = HOMEBOARD_CONFIG.weather.units === 'fahrenheit' ? 'F' : 'C';
    const lang = Lang.get();
    const descriptions = WMO_DESCRIPTIONS[lang] || WMO_DESCRIPTIONS.en;

    document.getElementById('weather-icon').textContent = WMO_ICONS[code] || '\u2600\uFE0F';
    document.getElementById('weather-temp').textContent = `${Math.round(current.temperature_2m)}\u00B0${unitSymbol}`;
    document.getElementById('weather-desc').textContent = descriptions[code] || 'Unknown';
    document.getElementById('weather-humidity').textContent = `${current.relative_humidity_2m}%`;

    // Wind with direction arrow
    const windDir = current.wind_direction_10m || 0;
    const windArrow = getWindArrow(windDir);
    document.getElementById('weather-wind').textContent = `${Math.round(current.wind_speed_10m)} km/h ${windArrow}`;

    // Feels like
    const feelsLike = Math.round(current.apparent_temperature);
    const feelsEl = document.getElementById('weather-feels');
    if (feelsEl) feelsEl.textContent = `${feelsLike}\u00B0`;

    // Clothing suggestion + weather warnings
    const clothingEl = document.getElementById('weather-clothing');
    if (clothingEl) {
      if (HOMEBOARD_CONFIG.weather.showClothing !== false) {
        const suggestions = [];
        const clothing = getClothingSuggestion(current.apparent_temperature, code, lang);
        if (clothing) suggestions.push(clothing);

        // Strong wind warning
        const windSpeed = current.wind_speed_10m || 0;
        if (windSpeed >= 50) {
          suggestions.push(lang === 'de' ? '💨 Starker Wind — Balkon sichern' : '💨 Strong wind — secure balcony');
        } else if (windSpeed >= 35) {
          suggestions.push(lang === 'de' ? '💨 Böiger Wind' : '💨 Gusty wind');
        }

        // Heat warning
        const feelsLike = current.apparent_temperature;
        if (feelsLike >= 32) {
          suggestions.push(lang === 'de' ? '🥵 Viel trinken, Sonne meiden' : '🥵 Stay hydrated, avoid sun');
        }

        clothingEl.textContent = suggestions.join(' · ');
      } else {
        clothingEl.textContent = '';
      }
    }
  }

  function getWindArrow(degrees) {
    // Arrow points in the direction wind is blowing TO (opposite of FROM)
    const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    const index = Math.round(degrees / 45) % 8;
    return arrows[index];
  }

  function getClothingSuggestion(feelsLike, code, lang) {
    const isRain = [51,53,55,61,63,65,80,81,82].includes(code);
    const isSnow = [71,73,75,77,85,86].includes(code);

    if (lang === 'de') {
      if (isSnow || feelsLike < 0) return '🧥 Winterjacke & Schal';
      if (feelsLike < 8) return '🧥 Jacke mitnehmen';
      if (isRain) return '☂️ Regenschirm nicht vergessen';
      if (feelsLike < 15) return '🧶 Pullover empfohlen';
      if (feelsLike > 28) return '🩳 Leichte Kleidung & Wasser';
      if (feelsLike > 22) return '👕 T-Shirt Wetter';
      return '';
    }
    // English fallback
    if (isSnow || feelsLike < 0) return '🧥 Winter coat & scarf';
    if (feelsLike < 8) return '🧥 Bring a jacket';
    if (isRain) return '☂️ Don\'t forget an umbrella';
    if (feelsLike < 15) return '🧶 Sweater recommended';
    if (feelsLike > 28) return '🩳 Light clothing & water';
    if (feelsLike > 22) return '👕 T-shirt weather';
    return '';
  }

  function renderForecast(data) {
    const daily = data.daily;
    if (!daily || !daily.time) return;

    const container = document.getElementById('weather-forecast');
    if (!container) return;

    const unitSymbol = HOMEBOARD_CONFIG.weather.units === 'fahrenheit' ? 'F' : 'C';
    const lang = Lang.get();
    const dayNames = DAY_NAMES[lang] || DAY_NAMES.en;

    // Skip today (index 0), show configured forecast days
    const numDays = HOMEBOARD_CONFIG.weather.forecastDays || 4;
    const todayHigh = Math.round(daily.temperature_2m_max[0]);
    container.innerHTML = daily.time.slice(1, numDays + 1).map((dateStr, i) => {
      const idx = i + 1;
      const date = new Date(dateStr + 'T12:00:00');
      const day = dayNames[date.getDay()];
      const code = daily.weather_code[idx];
      const high = Math.round(daily.temperature_2m_max[idx]);
      const low = Math.round(daily.temperature_2m_min[idx]);
      const icon = WMO_ICONS[code] || '\u2600\uFE0F';

      // Warmer/colder than today indicator
      const diff = high - todayHigh;
      let trend = '';
      if (diff >= 3) trend = '<span class="forecast-trend forecast-warmer">↑</span>';
      else if (diff <= -3) trend = '<span class="forecast-trend forecast-colder">↓</span>';

      return `<div class="forecast-day">
        <span class="forecast-name">${day}</span>
        <span class="forecast-icon">${icon}</span>
        <span class="forecast-temps">${high}\u00B0 <small>${low}\u00B0</small>${trend}</span>
      </div>`;
    }).join('');
  }

  return { init };
})();
