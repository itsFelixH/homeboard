/**
 * Rain module - hourly precipitation forecast for the next 12 hours
 * Uses Open-Meteo hourly precipitation + precipitation_probability
 */
const Rain = (() => {
  let refreshInterval;

  function init() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;
    if (!latitude || !longitude) {
      document.getElementById('rain-summary').textContent = 'Set location in config';
      return;
    }
    const refreshMin = (HOMEBOARD_CONFIG.rain && HOMEBOARD_CONFIG.rain.refreshMinutes) || 15;
    fetchRain();
    refreshInterval = setInterval(fetchRain, refreshMin * 60 * 1000);
  }

  async function fetchRain() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;

    const forecastHours = (HOMEBOARD_CONFIG.rain && HOMEBOARD_CONFIG.rain.forecastHours) || 12;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&hourly=precipitation,precipitation_probability` +
      `&timezone=auto&forecast_hours=${forecastHours}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      console.error('Rain fetch failed:', err);
      document.getElementById('rain-summary').textContent = 'Error loading rain data';
      document.getElementById('rain-bars').innerHTML = '';
    }
  }

  function render(data) {
    const hourly = data.hourly;
    if (!hourly || !hourly.time) return;

    const now = new Date();
    const currentHour = now.getHours();

    // Find the index for the current hour
    let startIdx = 0;
    for (let i = 0; i < hourly.time.length; i++) {
      const h = new Date(hourly.time[i]);
      if (h >= now) {
        startIdx = i;
        break;
      }
    }

    // Take next hours from current (based on config)
    const forecastHours = (HOMEBOARD_CONFIG.rain && HOMEBOARD_CONFIG.rain.forecastHours) || 12;
    const hours = hourly.time.slice(startIdx, startIdx + forecastHours);
    const precip = hourly.precipitation.slice(startIdx, startIdx + forecastHours);
    const prob = hourly.precipitation_probability.slice(startIdx, startIdx + forecastHours);

    // Summary text
    const totalMm = precip.reduce((sum, v) => sum + v, 0);
    const maxProb = Math.max(...prob);
    const summaryEl = document.getElementById('rain-summary');
    const barsEl = document.getElementById('rain-bars');

    if (totalMm === 0 && maxProb < 20) {
      const hrs = (HOMEBOARD_CONFIG.rain && HOMEBOARD_CONFIG.rain.forecastHours) || 12;
      summaryEl.innerHTML = `☀️ ${i18n('rain_none') || `No rain expected next ${hrs}h`}`;
      barsEl.innerHTML = '';
      barsEl.style.display = 'none';
      return;
    } else if (totalMm < 1) {
      summaryEl.innerHTML = `☁️ ${i18n('rain_light') || 'Light rain possible'} (${maxProb}%)`;
    } else {
      summaryEl.innerHTML = `☂️ ${totalMm.toFixed(1)} mm <span class="rain-badge">${maxProb}%</span>`;
    }

    barsEl.style.display = 'flex';

    // Actionable recommendation
    const lang = Lang.get();
    const rainSoon = prob.slice(0, 2).some(p => p > 50); // rain likely in next 2h
    let recEl = document.getElementById('rain-rec');
    if (!recEl) {
      recEl = document.createElement('div');
      recEl.id = 'rain-rec';
      recEl.className = 'metric-rec';
      summaryEl.parentNode.insertBefore(recEl, barsEl);
    }

    if (rainSoon) {
      recEl.textContent = lang === 'de' ? '☂️ Regenschirm mitnehmen' : lang === 'es' ? '☂️ Lleva paraguas' : '☂️ Bring an umbrella';
    } else if (totalMm === 0 && maxProb < 30) {
      recEl.textContent = lang === 'de' ? '🪟 Guter Tag zum Lüften' : lang === 'es' ? '🪟 Buen día para ventilar' : '🪟 Good day to air out';
    } else if (maxProb > 60) {
      // Find the dry window (last hour with < 30% probability before rain starts)
      let dryUntilHour = null;
      for (let i = 0; i < prob.length; i++) {
        if (prob[i] >= 40) {
          dryUntilHour = new Date(hours[i]).getHours();
          break;
        }
      }
      if (dryUntilHour !== null) {
        recEl.textContent = lang === 'de'
          ? `🚲 Trocken bis ${dryUntilHour}:00`
          : lang === 'es'
          ? `🚲 Seco hasta las ${dryUntilHour}:00`
          : `🚲 Dry window until ${dryUntilHour}:00`;
      } else {
        recEl.textContent = lang === 'de' ? '🌧️ Später Regen möglich' : lang === 'es' ? '🌧️ Lluvia probable más tarde' : '🌧️ Rain likely later';
      }
    } else {
      recEl.textContent = '';
    }

    // Render bar chart
    const maxPrecip = Math.max(...precip, 2); // min scale 2mm

    barsEl.innerHTML = hours.map((timeStr, i) => {
      const h = new Date(timeStr).getHours();
      const height = Math.max((precip[i] / maxPrecip) * 100, prob[i] > 0 ? 4 : 0);
      const opacity = precip[i] > 0 ? 1 : 0.4;
      const isCurrent = i === 0;

      return `<div class="rain-bar-col ${isCurrent ? 'rain-bar-current' : ''}" onclick="Rain.showDetail(this, '${h}:00', ${precip[i]}, ${prob[i]})">
        <div class="rain-bar" style="height:${height}%;opacity:${opacity}"></div>
        <span class="rain-hour">${h}</span>
      </div>`;
    }).join('');
  }

  function showDetail(el, time, mm, pct) {
    // Remove any existing tooltip
    const existing = document.querySelector('.rain-tooltip');
    if (existing) existing.remove();

    // Create tooltip
    const tip = document.createElement('div');
    tip.className = 'rain-tooltip';
    tip.textContent = `${time} · ${mm.toFixed(1)} mm · ${pct}%`;
    el.appendChild(tip);

    // Auto-dismiss after 3s or on next click
    setTimeout(() => tip.remove(), 3000);
  }

  return { init, showDetail };
})();
