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
    fetchRain();
    refreshInterval = setInterval(fetchRain, 15 * 60 * 1000); // every 15 min
  }

  async function fetchRain() {
    const { latitude, longitude } = HOMEBOARD_CONFIG.location;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&hourly=precipitation,precipitation_probability` +
      `&timezone=auto&forecast_hours=12`;

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

    // Take next 12 hours from current
    const hours = hourly.time.slice(startIdx, startIdx + 12);
    const precip = hourly.precipitation.slice(startIdx, startIdx + 12);
    const prob = hourly.precipitation_probability.slice(startIdx, startIdx + 12);

    // Summary text
    const totalMm = precip.reduce((sum, v) => sum + v, 0);
    const maxProb = Math.max(...prob);
    const summaryEl = document.getElementById('rain-summary');
    const barsEl = document.getElementById('rain-bars');

    if (totalMm === 0 && maxProb < 20) {
      summaryEl.innerHTML = `☀️ ${i18n('rain_none') || 'No rain expected next 12h'}`;
      barsEl.innerHTML = '';
      barsEl.style.display = 'none';
      return;
    } else if (totalMm < 1) {
      summaryEl.innerHTML = `☁️ ${i18n('rain_light') || 'Light rain possible'} (${maxProb}%)`;
    } else {
      summaryEl.innerHTML = `☂️ ${totalMm.toFixed(1)} mm <span class="rain-badge">${maxProb}%</span>`;
    }

    barsEl.style.display = 'flex';

    // Render bar chart
    const maxPrecip = Math.max(...precip, 2); // min scale 2mm

    barsEl.innerHTML = hours.map((timeStr, i) => {
      const h = new Date(timeStr).getHours();
      const height = Math.max((precip[i] / maxPrecip) * 100, prob[i] > 0 ? 4 : 0);
      const opacity = precip[i] > 0 ? 1 : 0.4;
      const isCurrent = i === 0;

      return `<div class="rain-bar-col ${isCurrent ? 'rain-bar-current' : ''}">
        <div class="rain-bar" style="height:${height}%;opacity:${opacity}" title="${precip[i]}mm (${prob[i]}%)"></div>
        <span class="rain-hour">${h}</span>
      </div>`;
    }).join('');
  }

  return { init };
})();
