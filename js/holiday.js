/**
 * Holiday / Vacation Countdown module
 * - Multi-unit live ticking countdown modal (Days, Hours, Min, Sec)
 * - Dynamic Destination Photo Backdrop & Climate Info
 * - Timezone, Local Destination Time & Live Currency Converter
 * - Fully customizable interactive packing checklist (Add/Delete/Check, persistent in localStorage)
 * - Google Docs / Sheets / Notion planning document integration
 */
const Holiday = (() => {
  const STATE_KEY = 'homeboard_custom_vacation_names';
  const MAX_VACATIONS = () => (HOMEBOARD_CONFIG.countdown && HOMEBOARD_CONFIG.countdown.maxVacations) || 3;

  let _vacationsList = [];
  let _countdownTimer = null;
  let _currentModalIdx = -1;
  let _modalKeyHandler = null;

  async function init() {
    const config = HOMEBOARD_CONFIG.countdown || HOMEBOARD_CONFIG.cards?.countdown;
    if (!config || config.enabled === false) return;

    await fetchAndFind();
    const refreshMinutes = config.refreshMinutes || 60;
    setInterval(fetchAndFind, refreshMinutes * 60 * 1000);
  }

  async function getCustomNames() {
    try {
      if (window.State?.get) {
        const stateRes = await Promise.race([
          State.get(STATE_KEY),
          new Promise(res => setTimeout(() => res(null), 300))
        ]);
        if (stateRes) return stateRes;
      }
    } catch (e) {}
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    } catch (e) {
      return {};
    }
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
    const calConfig = HOMEBOARD_CONFIG.calendar || HOMEBOARD_CONFIG.cards?.calendar || {};
    const countConfig = HOMEBOARD_CONFIG.countdown || HOMEBOARD_CONFIG.cards?.countdown || {};
    const icsUrl = countConfig.icsUrl || calConfig.icsUrl;

    try {
      let icsText = window._calendarCache;
      if (!icsText && icsUrl) {
        const url = `/proxy?url=${encodeURIComponent(icsUrl)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        icsText = await res.text();
        window._calendarCache = icsText;
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
          const rawKw = HOMEBOARD_CONFIG.countdown?.keywords || HOMEBOARD_CONFIG.countdown?.keyword || 'Urlaub';
          const keywords = Array.isArray(rawKw) ? rawKw : [rawKw];
          if (keywords.some(kw => event.summary.toLowerCase().includes(kw.toLowerCase()))) {
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

  // --- Packing List Management (localStorage persistent) ---
  const DEFAULT_PACKING_ITEMS = [
    '🛂 Reisepass / Personalausweis',
    '🎟️ Tickets & Buchungsbestätigung',
    '🪪 Auslandskrankenversicherung & Kreditkarte',
    '🔌 Powerbank & Ladekabel',
    '🔌 Reiseadapter & Kopfhörer',
    '🧴 Sonnencreme & Sonnenbrille',
    '💊 Reiseapotheke & Pflaster',
    '🩱 Badesachen / Wanderschuhe',
    '🏖️ Strandtuch & Kulturbeutel'
  ];

  function getPackingItems(dateKey) {
    try {
      const saved = localStorage.getItem(`vac_pack_items_${dateKey}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [...(HOMEBOARD_CONFIG.countdown?.defaultPackingList || DEFAULT_PACKING_ITEMS)];
  }

  function savePackingItems(dateKey, items) {
    try {
      localStorage.setItem(`vac_pack_items_${dateKey}`, JSON.stringify(items));
    } catch (e) {}
  }

  function getPackedChecked(dateKey) {
    try {
      const saved = localStorage.getItem(`vac_pack_checked_${dateKey}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  }

  function savePackedChecked(dateKey, checkedMap) {
    try {
      localStorage.setItem(`vac_pack_checked_${dateKey}`, JSON.stringify(checkedMap));
    } catch (e) {}
  }

  function renderPackingList(dateKey) {
    const items = getPackingItems(dateKey);
    const checkedMap = getPackedChecked(dateKey);
    const total = items.length;
    const packedCount = items.filter(it => checkedMap[it]).length;
    const percent = total > 0 ? Math.round((packedCount / total) * 100) : 0;

    const listContainer = document.getElementById('vac-packing-items');
    const progLabel = document.getElementById('vac-pack-prog-label');
    const progBar = document.getElementById('vac-pack-prog-bar');

    if (progLabel) progLabel.textContent = `${packedCount}/${total} eingepackt (${percent}%)`;
    if (progBar) progBar.style.width = `${percent}%`;

    if (!listContainer) return;

    if (items.length === 0) {
      listContainer.innerHTML = '<div class="vac-pack-empty">Keine Gegenstände. Füge neue hinzu oder setze die Standardliste zurück.</div>';
      return;
    }

    listContainer.innerHTML = items.map((item, i) => {
      const isChecked = !!checkedMap[item];
      const safeItem = item.replace(/'/g, "\\'");
      return `
        <div class="vac-pack-row ${isChecked ? 'checked' : ''}">
          <label class="vac-pack-label">
            <input type="checkbox" class="vac-pack-checkbox" ${isChecked ? 'checked' : ''} onchange="Holiday.togglePackItem('${dateKey}', '${safeItem}', this.checked)">
            <span class="vac-pack-text">${item}</span>
          </label>
          <button class="vac-pack-del-btn" onclick="Holiday.deletePackItem('${dateKey}', ${i})" title="Löschen">✕</button>
        </div>
      `;
    }).join('');
  }

  function resetPackingList(dateKey) {
    try {
      localStorage.removeItem(`vac_pack_items_${dateKey}`);
      localStorage.removeItem(`vac_pack_checked_${dateKey}`);
    } catch (e) {}
    renderPackingList(dateKey);
  }

  function togglePackItem(dateKey, itemText, checked) {
    const checkedMap = getPackedChecked(dateKey);
    checkedMap[itemText] = checked;
    savePackedChecked(dateKey, checkedMap);
    renderPackingList(dateKey);
  }

  function addCustomPackItem(dateKey) {
    const input = document.getElementById('vac-new-pack-item');
    if (!input || !input.value.trim()) return;
    const text = input.value.trim();
    const items = getPackingItems(dateKey);
    items.push(text);
    savePackingItems(dateKey, items);
    input.value = '';
    renderPackingList(dateKey);
  }

  function deletePackItem(dateKey, index) {
    const items = getPackingItems(dateKey);
    const removed = items.splice(index, 1)[0];
    savePackingItems(dateKey, items);
    if (removed) {
      const checkedMap = getPackedChecked(dateKey);
      delete checkedMap[removed];
      savePackedChecked(dateKey, checkedMap);
    }
    renderPackingList(dateKey);
  }

  // --- Planning Document (Google Docs / Sheets) ---
  function getPlanningDocUrl(dateKey, vacDesc) {
    try {
      const custom = localStorage.getItem(`vac_doc_${dateKey}`);
      if (custom && custom.trim()) return custom.trim();
      const cfgDoc = HOMEBOARD_CONFIG.countdown?.docs?.[dateKey];
      if (cfgDoc) return cfgDoc;
    } catch (e) {}

    if (vacDesc) {
      const m = vacDesc.match(/https?:\/\/(docs\.google\.com\/(?:document|spreadsheets)\/[^\s\\)]+|notion\.so\/[^\s\\)]+)/);
      if (m) return m[0];
    }
    return '';
  }

  function savePlanningDocUrl(dateKey, url) {
    try {
      if (url && url.trim()) {
        localStorage.setItem(`vac_doc_${dateKey}`, url.trim());
      } else {
        localStorage.removeItem(`vac_doc_${dateKey}`);
      }
    } catch (e) {}
    showVacationDetail(_currentModalIdx);
  }

  function promptDocLink(dateKey, currentUrl) {
    const docBox = document.getElementById('vac-doc-container');
    if (!docBox) return;

    docBox.innerHTML = `
      <div class="vac-doc-input-box">
        <input type="url" id="vac-doc-input-field" class="vac-doc-input" placeholder="Google Docs / Sheets Link einfügen..." value="${currentUrl || ''}" />
        <button class="detail-action-btn detail-action-primary" onclick="Holiday.savePlanningDocUrl('${dateKey}', document.getElementById('vac-doc-input-field').value)">Speichern</button>
        <button class="detail-action-btn" onclick="Holiday.showVacationDetail(${_currentModalIdx})">Abbrechen</button>
      </div>
    `;
    const field = document.getElementById('vac-doc-input-field');
    if (field) { field.focus(); field.select(); }
  }

  // --- Destination Photo Backdrop Determination ---
  function getDestinationBanner(query) {
    const q = (query || '').toLowerCase();
    if (/mallorca|palma|balearen|strand|beach|ibiza|menorca/i.test(q)) {
      return { gradient: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(245, 158, 11, 0.25))', icon: '🏖️' };
    }
    if (/spanien|spain|barcelona|madrid|andalusien|valencia/i.test(q)) {
      return { gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(245, 158, 11, 0.25))', icon: '🇪🇸' };
    }
    if (/italien|italy|rom|rome|toscana|florenz|venedig|gardasee|sizilien/i.test(q)) {
      return { gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(239, 68, 68, 0.25))', icon: '🇮🇹' };
    }
    if (/alpen|alps|wandern|hiking|berge|tirol|schweiz|swiss|österreich|dolomiten/i.test(q)) {
      return { gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(99, 102, 241, 0.25))', icon: '🏔️' };
    }
    if (/japan|tokio|tokyo|kyoto|osaka/i.test(q)) {
      return { gradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(99, 102, 241, 0.25))', icon: '🇯🇵' };
    }
    if (/usa|new york|california|florida|hawaii|san francisco/i.test(q)) {
      return { gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(239, 68, 68, 0.25))', icon: '🇺🇸' };
    }
    return { gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(168, 85, 247, 0.25))', icon: '✈️' };
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

    // Destination determination & banner backdrop
    const destinationQuery = HOMEBOARD_CONFIG.countdown?.destinations?.[dateKey] || extractDestination(label, vac.location, vac.description);
    const bannerInfo = getDestinationBanner(destinationQuery || label);

    const gmapsUrl = destinationQuery
      ? `https://maps.google.com/?q=${encodeURIComponent(destinationQuery)}`
      : `https://calendar.google.com/calendar/r/week/${vac.start.getFullYear()}/${vac.start.getMonth()+1}/${vac.start.getDate()}`;
    const calWeekUrl = `https://calendar.google.com/calendar/r/week/${vac.start.getFullYear()}/${vac.start.getMonth()+1}/${vac.start.getDate()}`;

    // Planning Doc URL
    const docUrl = getPlanningDocUrl(dateKey, vac.description);

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

        <!-- Scenic Hero Banner Section -->
        <div class="detail-hero-section vacation-scenic-hero" style="background: ${bannerInfo.gradient}; --event-accent: #06b6d4;">
          <div class="detail-title-row">
            <span class="detail-title">${label}</span>
            <span class="event-cat-tag">${bannerInfo.icon} Urlaub</span>
          </div>
          <div class="detail-time-line">
            <span class="detail-time-text">${rangeStr}${durationDays > 0 ? ` (${durationDays} Tage)` : ''}</span>
          </div>
          ${destinationQuery ? `<div class="detail-location-line">📍 <a href="${gmapsUrl}" target="_blank">${destinationQuery}</a></div>` : ''}
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

        <!-- Destination Weather & Timezone Box -->
        ${destinationQuery ? `
          <div class="detail-section-box" id="vac-weather-box">
            <div class="detail-section-title">
              <span>☀️ Reiseziel Info & Klima (${destinationQuery})</span>
            </div>
            <div id="vac-weather-content"><span class="detail-loading">Wetterdaten & Währung werden geladen...</span></div>
          </div>
        ` : ''}

        <!-- Google Docs / Sheets Planning Document -->
        <div class="detail-section-box" id="vac-doc-container">
          <div class="detail-section-title">
            <span>📄 Reiseplanung & Dokumente</span>
          </div>
          <div class="vac-doc-row">
            ${docUrl ? `
              <a href="${docUrl}" target="_blank" class="detail-action-btn detail-action-primary vac-doc-btn">
                📄 Google Docs / Sheets öffnen ↗
              </a>
              <button class="vac-doc-edit-btn" onclick="Holiday.promptDocLink('${dateKey}', '${docUrl.replace(/'/g, "\\'")}')" title="Link bearbeiten">✏️</button>
            ` : `
              <button class="detail-action-btn vac-doc-add-btn" onclick="Holiday.promptDocLink('${dateKey}', '')">
                ➕ Google Docs / Sheets Link verknüpfen
              </button>
            `}
          </div>
        </div>

        <!-- Customizable Packing Checklist -->
        <div class="detail-section-box bento-checklist-tile">
          <div class="detail-section-title">
            <span>🧳 Packliste (<span id="vac-pack-prog-label">0/0</span>)</span>
          </div>
          <div class="vac-pack-progress-track"><div class="vac-pack-progress-bar" id="vac-pack-prog-bar" style="width: 0%;"></div></div>
          <div class="vac-packing-list-container" id="vac-packing-items"></div>
          <div class="vac-pack-add-row">
            <input type="text" id="vac-new-pack-item" class="vac-pack-input" placeholder="+ Neuer Gegenstand..." onkeydown="if(event.key==='Enter') Holiday.addCustomPackItem('${dateKey}')" />
            <button class="detail-action-btn" onclick="Holiday.addCustomPackItem('${dateKey}')">➕ Hinzufügen</button>
          </div>
        </div>

        <!-- Actions Bar -->
        <div class="detail-actions-bar">
          <a href="${calWeekUrl}" target="_blank" class="detail-action-btn">
            📅 Google Kalender
          </a>
          <a href="${gmapsUrl}" target="_blank" class="detail-action-btn">
            📍 Maps
          </a>
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

    // Render interactive packing list
    renderPackingList(dateKey);

    // Start live ticking timer
    updateLiveTimer(vac.start);
    _countdownTimer = setInterval(() => updateLiveTimer(vac.start), 1000);

    // Fetch destination weather, timezone & currency
    if (destinationQuery) {
      fetchDestinationDetails(destinationQuery);
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

  async function fetchDestinationDetails(query) {
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
      const countryCode = (place.country_code || '').toUpperCase();
      const timezone = place.timezone || 'auto';

      const meteoUrl = `/proxy?url=${encodeURIComponent(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=${timezone}`)}`;
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

      // Timezone & Local Time
      let destLocalTimeStr = '';
      let timeDiffStr = '';
      try {
        const destDate = new Date();
        const destFmt = new Intl.DateTimeFormat('de-DE', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(destDate);
        const localFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(destDate);
        destLocalTimeStr = `${destFmt} Uhr`;
        
        const destHour = parseInt(destFmt.split(':')[0]);
        const localHour = parseInt(localFmt.split(':')[0]);
        const diffH = destHour - localHour;
        if (diffH !== 0) {
          timeDiffStr = ` (${diffH > 0 ? '+' : ''}${diffH}h)`;
        }
      } catch (e) {}

      // Currency Check
      let currencyHtml = '';
      const currencyMap = {
        US: 'USD', GB: 'GBP', JP: 'JPY', CH: 'CHF', PL: 'PLN', CZ: 'CZK',
        SE: 'SEK', DK: 'DKK', NO: 'NOK', AU: 'AUD', CA: 'CAD', TH: 'THB'
      };
      const targetCur = currencyMap[countryCode];
      if (targetCur) {
        try {
          const fxRes = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${targetCur}`);
          if (fxRes.ok) {
            const fxData = await fxRes.json();
            const rate = fxData.rates[targetCur];
            if (rate) {
              currencyHtml = `<div class="vac-meta-line">💱 <strong>10 € = ${(10 * rate).toFixed(targetCur === 'JPY' ? 0 : 2)} ${targetCur}</strong></div>`;
            }
          }
        } catch (e) {}
      } else {
        currencyHtml = `<div class="vac-meta-line">💶 <strong>Euro-Zone</strong> · Keine Wechselgebühr</div>`;
      }

      weatherBox.innerHTML = `
        <div class="vac-weather-grid">
          <div class="vac-weather-main">
            <span class="vac-weather-icon">${icon}</span>
            <div>
              <span class="vac-weather-temp">${Math.round(cur.temperature_2m)}°C</span>
              <span class="vac-weather-feel">Gefühlt ${Math.round(cur.apparent_temperature)}°C</span>
            </div>
          </div>
          <div class="vac-weather-details">
            <div>📍 <strong>${place.name}${country ? ', ' + country : ''}</strong></div>
            ${destLocalTimeStr ? `<div>🕒 Ortszeit: <strong>${destLocalTimeStr}</strong>${timeDiffStr}</div>` : ''}
            ${currencyHtml}
          </div>
        </div>
      `;
    } catch (e) {
      weatherBox.innerHTML = '<div class="detail-route-simple">Wetter- und Reisedaten konnten nicht geladen werden.</div>';
    }
  }

  function extractDestination(label, location, desc) {
    if (location && location.trim()) {
      return location.split(',')[0].trim();
    }
    const text = `${label || ''} ${desc || ''}`;
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

  function refresh(icsText) {
    if (icsText) {
      window._calendarCache = icsText;
      const vacations = findNextVacations(icsText);
      if (vacations.length > 0) {
        renderAll(vacations);
      } else {
        showFallback();
      }
    } else {
      fetchAndFind();
    }
  }

  return {
    init,
    refresh,
    showVacationDetail,
    triggerEdit,
    togglePackItem,
    addCustomPackItem,
    deletePackItem,
    resetPackingList,
    promptDocLink,
    savePlanningDocUrl,
    copyVacationDetails,
    navigateModal,
    closeModal
  };
})();
