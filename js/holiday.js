/**
 * Holiday / Vacation Countdown module
 * - Finds upcoming vacations from the Google Calendar ICS feed matching keyword
 * - Multi-unit live ticking countdown modal (Days, Hours, Min, Sec)
 * - Destination weather preview, packing checklist, and logistics
 */
const Holiday = (() => {
  const STATE_KEY = 'homeboard_custom_vacation_names';
  const MAX_VACATIONS = () => (HOMEBOARD_CONFIG.countdown && HOMEBOARD_CONFIG.countdown.maxVacations) || 3;

  let _vacationsList = [];
  let _countdownTimer = null;
  let _currentModalIdx = -1;
  let _modalKeyHandler = null;

  async function init() {
    const config = HOMEBOARD_CONFIG.countdown;
    if (!config || !config.enabled) return;

    await fetchAndFind();
    const refreshMinutes = config.refreshMinutes || 60;
    setInterval(fetchAndFind, refreshMinutes * 60 * 1000);
  }

  async function getCustomNames() {
    return (await State.get(STATE_KEY)) || {};
  }

  async function saveCustomName(dateKey, name) {
    const names = await getCustomNames();
    if (name && name.trim()) {
      names[dateKey] = name.trim();
    } else {
      delete names[dateKey];
    }
    await State.set(STATE_KEY, names);
  }

  function showFallback() {
    const config = HOMEBOARD_CONFIG.countdown;
    if (config && config.date) {
      renderAll([{ start: new Date(config.date + 'T00:00:00'), summary: config.label || 'Vacation' }]);
    } else {
      const el = document.getElementById('countdown-list');
      if (el) el.innerHTML = `<div class="countdown-empty">${(window.i18n && typeof window.i18n === 'function') ? window.i18n('countdown_none') : 'Kein Urlaub gefunden'}</div>`;
    }
  }

  async function fetchAndFind() {
    const calConfig = HOMEBOARD_CONFIG.calendar;

    try {
      let icsText = window._calendarCache;
      if (!icsText) {
        const url = `/proxy?url=${encodeURIComponent(calConfig.icsUrl)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        icsText = await res.text();
      }
      const vacations = findNextVacations(icsText);

      if (vacations.length > 0) {
        renderAll(vacations);
      } else {
        showFallback();
      }
    } catch (err) {
      console.error('Countdown calendar fetch failed:', err);
      showFallback();
    }
  }

  function findNextVacations(text) {
    const lines = text.replace(/\r\n /g, '').split(/\r?\n/);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let event = null;
    let candidates = [];

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        event = {};
      } else if (line === 'END:VEVENT' && event) {
        if (event.summary && event.start) {
          const keyword = (HOMEBOARD_CONFIG.countdown && HOMEBOARD_CONFIG.countdown.keyword) || 'Urlaub';
          if (event.summary.toLowerCase().includes(keyword.toLowerCase())) {
            const eventMidnight = new Date(
              event.start.getFullYear(),
              event.start.getMonth(),
              event.start.getDate()
            );
            if (eventMidnight >= todayMidnight) {
              candidates.push(event);
            }
          }
        }
        event = null;
      } else if (event) {
        if (line.startsWith('DTSTART')) {
          event.start = parseICSDate(line.split(':').pop());
        } else if (line.startsWith('DTEND')) {
          event.end = parseICSDate(line.split(':').pop());
        } else if (line.startsWith('SUMMARY')) {
          event.summary = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        } else if (line.startsWith('LOCATION')) {
          event.location = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        } else if (line.startsWith('DESCRIPTION')) {
          event.description = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        }
      }
    }

    candidates.sort((a, b) => a.start - b.start);
    return candidates.slice(0, MAX_VACATIONS());
  }

  function parseICSDate(str) {
    if (!str) return null;
    const clean = str.replace(/[^0-9T]/g, '');
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));
    const hour = parseInt(clean.slice(9, 11)) || 0;
    const minute = parseInt(clean.slice(11, 13)) || 0;

    if (str.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute));
    }
    return new Date(year, month, day, hour, minute);
  }

  function makeDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  function startEdit(dateKey, currentLabel, labelEl, evt) {
    if (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'countdown-label-input';
    input.value = currentLabel;
    input.placeholder = 'Name...';

    const finish = () => {
      const newName = input.value.trim();
      saveCustomName(dateKey, newName);
      labelEl.textContent = newName || currentLabel;
      labelEl.style.display = '';
      input.remove();
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.value = currentLabel;
        input.blur();
      }
    });

    labelEl.style.display = 'none';
    labelEl.parentNode.insertBefore(input, labelEl);
    input.focus();
    input.select();
  }

  async function renderAll(vacations) {
    _vacationsList = vacations;
    const container = document.getElementById('countdown-list');
    if (!container) return;

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const customNames = await getCustomNames();
    const configNames = HOMEBOARD_CONFIG.countdown?.names || {};

    container.innerHTML = vacations.map((vac, idx) => {
      const targetMidnight = new Date(
        vac.start.getFullYear(),
        vac.start.getMonth(),
        vac.start.getDate()
      );
      const diffMs = targetMidnight - todayMidnight;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let daysText, sublabel;
      const lang = (window.Lang && typeof window.Lang.get === 'function') ? window.Lang.get() : 'de';
      if (diffDays < 0) {
        daysText = '✔';
        sublabel = (window.i18n && typeof window.i18n === 'function') ? window.i18n('countdown_started') : 'Bereits gestartet!';
      } else if (diffDays === 0) {
        daysText = '🎉';
        sublabel = (window.i18n && typeof window.i18n === 'function') ? window.i18n('countdown_today') : 'Heute!';
      } else if (diffDays === 1) {
        daysText = diffDays;
        sublabel = lang === 'de' ? '🧳 Koffer packen!' : lang === 'es' ? '🧳 ¡Hacer la maleta!' : '🧳 Pack your bags!';
      } else if (diffDays <= 3) {
        daysText = diffDays;
        sublabel = lang === 'de' ? '⏳ Bald gehts los!' : lang === 'es' ? '⏳ ¡Casi es hora!' : '⏳ Almost there!';
      } else {
        daysText = diffDays;
        sublabel = '';
      }

      const dateKey = makeDateKey(vac.start);
      const label = customNames[dateKey] || configNames[dateKey] || vac.summary || 'Urlaub';
      const dateStr = vac.start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

      return `<div class="countdown-item" onclick="Holiday.showVacationDetail(${idx})" style="cursor: pointer;">
        <div class="countdown-link-wrap">
          <span class="countdown-days">${daysText}</span>
          <div class="countdown-meta">
            <span class="countdown-label" data-date-key="${dateKey}">${label}</span>
            <span class="countdown-sublabel">${dateStr}${sublabel ? ' · ' + sublabel : ''}</span>
          </div>
        </div>
        <button class="countdown-edit-btn" data-date-key="${dateKey}" title="Umbenennen" aria-label="Rename" onclick="Holiday.triggerEdit('${dateKey}', this, event)">✏️</button>
      </div>`;
    }).join('');
  }

  function triggerEdit(dateKey, btn, evt) {
    if (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }
    const labelEl = btn.parentNode.querySelector(`.countdown-label[data-date-key="${dateKey}"]`);
    if (labelEl) startEdit(dateKey, labelEl.textContent, labelEl, evt);
  }

  async function showVacationDetail(idx) {
    if (!_vacationsList || !_vacationsList[idx]) return;
    _currentModalIdx = idx;
    const vac = _vacationsList[idx];

    const existing = document.getElementById('vacation-detail-overlay');
    if (existing) existing.remove();
    if (_countdownTimer) clearInterval(_countdownTimer);
    if (_modalKeyHandler) window.removeEventListener('keydown', _modalKeyHandler);

    const customNames = await getCustomNames();
    const configNames = HOMEBOARD_CONFIG.countdown?.names || {};
    const dateKey = makeDateKey(vac.start);
    const label = customNames[dateKey] || configNames[dateKey] || vac.summary || 'Urlaub';

    const totalVac = _vacationsList.length;
    const hasPrev = idx > 0;
    const hasNext = idx < totalVac - 1;

    // Date range string
    const startStr = vac.start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    let rangeStr = startStr;
    let durationDays = 0;
    if (vac.end) {
      const endStr = vac.end.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
      rangeStr = `${startStr} – ${endStr}`;
      durationDays = Math.round((vac.end - vac.start) / (1000 * 60 * 60 * 24));
    }

    // Guess destination from title/summary or location
    const destinationQuery = extractDestination(label, vac.location, vac.description);
    const gmapsUrl = destinationQuery
      ? `https://maps.google.com/?q=${encodeURIComponent(destinationQuery)}`
      : `https://calendar.google.com/calendar/r/week/${vac.start.getFullYear()}/${vac.start.getMonth()+1}/${vac.start.getDate()}`;

    const calWeekUrl = `https://calendar.google.com/calendar/r/week/${vac.start.getFullYear()}/${vac.start.getMonth()+1}/${vac.start.getDate()}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(gmapsUrl)}&margin=4`;

    // Packing list state
    const packingKey = `vac_pack_${dateKey}`;
    let packedItems = {};
    try {
      packedItems = JSON.parse(sessionStorage.getItem(packingKey) || '{}');
    } catch (e) {}

    const defaultPackingList = [
      { id: 'p_pass', text: '🛂 Reisepass / Personalausweis', cat: 'Dokumente' },
      { id: 'p_ticket', text: '🎟️ Tickets & Buchungsbestätigung', cat: 'Dokumente' },
      { id: 'p_vers', text: '🪪 Auslandskrankenversicherung / EC-Karte', cat: 'Dokumente' },
      { id: 'p_power', text: '🔌 Powerbank & Ladekabel', cat: 'Technik' },
      { id: 'p_adapter', text: '🔌 Reiseadapter / Kopfhörer', cat: 'Technik' },
      { id: 'p_sun', text: '🧴 Sonnencreme & Sonnenbrille', cat: 'Reiseapotheke' },
      { id: 'p_meds', text: '💊 Reiseapotheke & Pflaster', cat: 'Reiseapotheke' },
      { id: 'p_clothes', text: '🩱 Badesachen / Wanderschuhe', cat: 'Kleidung' },
      { id: 'p_towel', text: '🏖️ Strandtuch & Kulturbeutel', cat: 'Kleidung' }
    ];

    const packingHtml = defaultPackingList.map(item => `
      <label class="bento-check-item ${packedItems[item.id] ? 'checked' : ''}">
        <input type="checkbox" ${packedItems[item.id] ? 'checked' : ''} onchange="Holiday.togglePackItem('${dateKey}', '${item.id}', this.checked, this.parentElement)">
        <span>${item.text}</span>
      </label>
    `).join('');

    const overlay = document.createElement('div');
    overlay.id = 'vacation-detail-overlay';
    overlay.innerHTML = `
      <div class="event-detail-card vacation-detail-card">
        <div class="detail-modal-header">
          <span class="detail-modal-title">🌴 Urlaubs-Countdown</span>
          <div class="detail-header-nav">
            ${totalVac > 1 ? `
              <button class="detail-nav-btn" ${!hasPrev ? 'disabled' : ''} onclick="Holiday.navigateModal(-1)" title="Vorheriger Urlaub (←)">‹</button>
              <span class="detail-nav-count">${idx + 1}/${totalVac}</span>
              <button class="detail-nav-btn" ${!hasNext ? 'disabled' : ''} onclick="Holiday.navigateModal(1)" title="Nächster Urlaub (→)">›</button>
            ` : ''}
            <button class="detail-close-btn" aria-label="Close" onclick="Holiday.closeModal()" title="Schließen (Esc)">✕</button>
          </div>
        </div>

        <div class="detail-hero-section" style="--event-accent: #06b6d4;">
          <div class="detail-title-row">
            <span class="detail-title">${label}</span>
            <span class="event-cat-tag">✈️ Urlaub</span>
          </div>
          <div class="detail-time-line">
            <span class="detail-time-text">${rangeStr}${durationDays > 0 ? ` (${durationDays} Tage)` : ''}</span>
          </div>
          ${vac.location ? `<div class="detail-location-line">📍 <a href="${gmapsUrl}" target="_blank">${vac.location}</a></div>` : ''}
        </div>

        <!-- Live Ticking Countdown Box -->
        <div class="detail-section-box countdown-live-box">
          <div class="detail-section-title">
            <span>⏳ Live Countdown</span>
            <span class="detail-dep-pill dep-calm" id="vac-status-pill">Warten</span>
          </div>
          <div class="countdown-timer-digits" id="vac-timer-digits">
            <div class="countdown-digit-cell"><span class="digit-val" id="vd-days">0</span><span class="digit-lbl">Tage</span></div>
            <div class="countdown-digit-cell"><span class="digit-val" id="vd-hours">0</span><span class="digit-lbl">Std</span></div>
            <div class="countdown-digit-cell"><span class="digit-val" id="vd-mins">0</span><span class="digit-lbl">Min</span></div>
            <div class="countdown-digit-cell"><span class="digit-val" id="vd-secs">0</span><span class="digit-lbl">Sek</span></div>
          </div>
        </div>

        <!-- Destination Weather Preview -->
        ${destinationQuery ? `
          <div class="detail-section-box" id="vac-weather-box">
            <div class="detail-section-title">
              <span>☀️ Reiseziel Wetter & Klima (${destinationQuery})</span>
            </div>
            <div id="vac-weather-content"><span class="detail-loading">Wetter für ${destinationQuery} wird geladen...</span></div>
          </div>
        ` : ''}

        <!-- Packing Checklist -->
        <div class="detail-section-box bento-checklist-tile">
          <div class="detail-section-title">
            <span>🧳 Packliste & Reisevorbereitung</span>
          </div>
          <div class="bento-checklist-grid">
            ${packingHtml}
          </div>
        </div>

        <!-- Actions Bar -->
        <div class="detail-actions-bar">
          <a href="${calWeekUrl}" target="_blank" class="detail-action-btn detail-action-primary">
            📅 Google Kalender
          </a>
          ${destinationQuery ? `
            <a href="${gmapsUrl}" target="_blank" class="detail-action-btn">
              📍 Reiseziel Maps
            </a>
          ` : ''}
          <button class="detail-action-btn" onclick="Holiday.copyVacationDetails(${idx}, this)">
            📋 Kopieren
          </button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('detail-close-btn')) {
        closeModal();
      }
    });

    _modalKeyHandler = (e) => {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowLeft') navigateModal(-1);
      else if (e.key === 'ArrowRight') navigateModal(1);
    };
    window.addEventListener('keydown', _modalKeyHandler);

    document.body.appendChild(overlay);

    // Start live ticking timer
    updateLiveTimer(vac.start);
    _countdownTimer = setInterval(() => updateLiveTimer(vac.start), 1000);

    // Fetch destination weather if destinationQuery exists
    if (destinationQuery) {
      fetchDestinationWeather(destinationQuery);
    }
  }

  function updateLiveTimer(targetDate) {
    const now = new Date();
    const diffMs = targetDate - now;

    const daysEl = document.getElementById('vd-days');
    const hoursEl = document.getElementById('vd-hours');
    const minsEl = document.getElementById('vd-mins');
    const secsEl = document.getElementById('vd-secs');
    const pillEl = document.getElementById('vac-status-pill');

    if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

    if (diffMs <= 0) {
      daysEl.textContent = '0';
      hoursEl.textContent = '0';
      minsEl.textContent = '0';
      secsEl.textContent = '0';
      if (pillEl) {
        pillEl.className = 'detail-dep-pill dep-urgent';
        pillEl.textContent = '🎉 Urlaub läuft!';
      }
      return;
    }

    const totalSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    daysEl.textContent = days;
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(mins).padStart(2, '0');
    secsEl.textContent = String(secs).padStart(2, '0');

    if (pillEl) {
      if (days === 0) {
        pillEl.className = 'detail-dep-pill dep-urgent';
        pillEl.textContent = '⚡ Geht heute los!';
      } else if (days === 1) {
        pillEl.className = 'detail-dep-pill dep-soon';
        pillEl.textContent = '🧳 Morgen!';
      } else if (days <= 7) {
        pillEl.className = 'detail-dep-pill dep-soon';
        pillEl.textContent = `in ${days} Tagen`;
      } else {
        pillEl.className = 'detail-dep-pill dep-calm';
        pillEl.textContent = `in ${days} Tagen`;
      }
    }
  }

  async function fetchDestinationWeather(query) {
    const weatherBox = document.getElementById('vac-weather-content');
    if (!weatherBox) return;

    try {
      const geoUrl = `/proxy?url=${encodeURIComponent(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de&format=json`)}`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error('Geo failed');
      const geoData = await geoRes.json();
      if (!geoData.results || !geoData.results.length) {
        weatherBox.innerHTML = '<div class="detail-route-simple">Ort konnte nicht lokalisiert werden.</div>';
        return;
      }

      const place = geoData.results[0];
      const lat = place.latitude;
      const lon = place.longitude;
      const country = place.country || '';

      const meteoUrl = `/proxy?url=${encodeURIComponent(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`)}`;
      const mRes = await fetch(meteoUrl);
      if (!mRes.ok) throw new Error('Weather failed');
      const mData = await mRes.json();
      const cur = mData.current;

      const codeIcons = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
        45: '🌫️', 48: '🌫️',
        51: '🌦️', 53: '🌦️', 55: '🌧️',
        61: '🌧️', 63: '🌧️', 65: '🌧️',
        71: '🌨️', 73: '🌨️', 75: '❄️',
        80: '🌦️', 81: '🌧️', 82: '🌧️',
        95: '⛈️'
      };
      const icon = codeIcons[cur.weather_code] || '🌤️';

      weatherBox.innerHTML = `
        <div class="vac-weather-grid">
          <div class="vac-weather-main">
            <span class="vac-weather-icon">${icon}</span>
            <span class="vac-weather-temp">${Math.round(cur.temperature_2m)}°C</span>
            <span class="vac-weather-feel">Gefühlt ${Math.round(cur.apparent_temperature)}°C</span>
          </div>
          <div class="vac-weather-details">
            <div>📍 ${place.name}${country ? ', ' + country : ''}</div>
            <div>💨 Wind: ${Math.round(cur.wind_speed_10m)} km/h</div>
            <div>💧 Luftfeuchtigkeit: ${cur.relative_humidity_2m}%</div>
          </div>
        </div>
      `;
    } catch (e) {
      weatherBox.innerHTML = '<div class="detail-route-simple">Wetterdaten aktuell nicht verfügbar.</div>';
    }
  }

  function extractDestination(label, location, desc) {
    if (location && location.trim()) {
      return location.split(',')[0].trim();
    }
    const text = `${label || ''} ${desc || ''}`;
    // Strip common words
    const clean = text
      .replace(/urlaub/gi, '')
      .replace(/vacation/gi, '')
      .replace(/reise/gi, '')
      .replace(/trip/gi, '')
      .replace(/sommer/gi, '')
      .replace(/winter/gi, '')
      .replace(/herbst/gi, '')
      .replace(/ferien/gi, '')
      .trim();

    if (clean.length > 2) return clean.split(/[-–—/]/)[0].trim();
    return null;
  }

  function togglePackItem(dateKey, itemId, checked, parentEl) {
    if (parentEl) parentEl.classList.toggle('checked', checked);
    const packingKey = `vac_pack_${dateKey}`;
    let packed = {};
    try { packed = JSON.parse(sessionStorage.getItem(packingKey) || '{}'); } catch (e) {}
    packed[itemId] = checked;
    try { sessionStorage.setItem(packingKey, JSON.stringify(packed)); } catch (e) {}
  }

  function copyVacationDetails(idx, btn) {
    const vac = _vacationsList[idx];
    if (!vac) return;

    const startStr = vac.start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    const lines = [
      `🌴 ${vac.summary || 'Urlaub'}`,
      `📅 Start: ${startStr}`
    ];
    if (vac.end) {
      lines.push(`📅 Ende: ${vac.end.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    }
    if (vac.location) lines.push(`📍 ${vac.location}`);

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ Kopiert!';
        setTimeout(() => { btn.innerHTML = orig; }, 1800);
      }
    }).catch(() => {});
  }

  function navigateModal(direction) {
    if (_currentModalIdx === -1 || !_vacationsList.length) return;
    const next = _currentModalIdx + direction;
    if (next >= 0 && next < _vacationsList.length) {
      showVacationDetail(next);
    }
  }

  function closeModal() {
    const existing = document.getElementById('vacation-detail-overlay');
    if (existing) existing.remove();
    if (_countdownTimer) {
      clearInterval(_countdownTimer);
      _countdownTimer = null;
    }
    if (_modalKeyHandler) {
      window.removeEventListener('keydown', _modalKeyHandler);
      _modalKeyHandler = null;
    }
  }

  return { init, showVacationDetail, triggerEdit, togglePackItem, copyVacationDetails, navigateModal, closeModal };
})();
