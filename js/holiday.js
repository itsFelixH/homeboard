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
  let _autoCloseTimer = null;

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
          const rawKw = HOMEBOARD_CONFIG.countdown?.keywords || HOMEBOARD_CONFIG.countdown?.keyword || ['Urlaub', 'Vacation', 'Reise', 'Trip', 'Holiday', 'Ferien'];
          const keywords = Array.isArray(rawKw) ? rawKw : [rawKw];
          const summLower = event.summary.toLowerCase();
          if (keywords.some(kw => summLower.includes(kw.toLowerCase()))) {
            const startMidnight = new Date(
              event.start.getFullYear(),
              event.start.getMonth(),
              event.start.getDate()
            );
            const endMidnight = event.end
              ? new Date(event.end.getFullYear(), event.end.getMonth(), event.end.getDate())
              : startMidnight;
            if (endMidnight >= todayMidnight) {
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

  function getPackingItems(dateKey, destinationOrSummary = '') {
    try {
      const saved = localStorage.getItem(`vac_pack_items_${dateKey}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    // Check customChecklistTemplates matching destination / trip summary keywords
    const templates = HOMEBOARD_CONFIG.countdown?.customChecklistTemplates || {};
    const text = `${destinationOrSummary || ''} ${dateKey}`.toLowerCase();
    for (const [category, items] of Object.entries(templates)) {
      if (Array.isArray(items) && items.length > 0) {
        if (text.includes(category.toLowerCase())) {
          return [...items];
        }
      }
    }

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
    const items = getPackingItems(dateKey, destHint);
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
    const items = getPackingItems(dateKey, destHint);
    items.push(text);
    savePackingItems(dateKey, items);
    input.value = '';
    renderPackingList(dateKey);
  }

  function deletePackItem(dateKey, index) {
    const items = getPackingItems(dateKey, destHint);
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

    const countCfg = HOMEBOARD_CONFIG.countdown || {};
    const modalCfg = HOMEBOARD_CONFIG.modals || {};

    const customNames = await getCustomNames();
    const configNames = countCfg.names || {};
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
      durationDays = Math.max(1, Math.round((vac.end - vac.start) / (1000 * 60 * 60 * 24)));
    }

    // Destination determination
    const configDests = countCfg.destinations || {};
    const destLocation = configDests[dateKey] || extractDestination(vac.location, vac.summary, label);
    const bannerMeta = getDestinationBanner(destLocation || label);

    // Planning Doc URL
    const docUrl = getPlanningDocUrl(dateKey);

    // Modal Config Options
    const showWeather = countCfg.showWeather !== false;
    const showPackingList = countCfg.showPackingList !== false;
    const showCurrency = countCfg.showCurrency !== false;

    const animClass = `modal-anim-${modalCfg.animation || 'scale'}`;
    const noBlurClass = modalCfg.backdropBlur === false ? 'modal-no-blur' : '';

    const overlay = document.createElement('div');
    overlay.id = 'vacation-detail-overlay';
    if (noBlurClass) overlay.className = noBlurClass;

    overlay.innerHTML = `
      <div class="event-detail-card vacation-detail-card ${animClass}">
        <div class="detail-modal-header">
          <span class="detail-modal-title">✈️ Urlaubs- & Reiseplaner</span>
          <div class="detail-header-nav">
            ${totalVac > 1 ? `
              <button class="detail-nav-btn" ${!hasPrev ? 'disabled' : ''} onclick="Holiday.navigateModal(-1)" title="Vorherige Reise (◀)">&lt;</button>
              <span class="detail-nav-count">${idx + 1}/${totalVac}</span>
              <button class="detail-nav-btn" ${!hasNext ? 'disabled' : ''} onclick="Holiday.navigateModal(1)" title="Nächste Reise (▶)">&gt;</button>
            ` : ''}
            <button class="detail-close-btn" aria-label="Close" onclick="Holiday.closeModal()" title="Schließen (Esc)">✕</button>
          </div>
        </div>

        <!-- Destination Hero Banner -->
        <div class="vac-hero-banner" style="background: ${bannerMeta.gradient};">
          <div class="vac-hero-top">
            <span class="vac-hero-icon">${bannerMeta.icon}</span>
            <div class="vac-hero-titles">
              <span class="vac-hero-destination">${label}</span>
              <span class="vac-hero-sub">${destLocation ? destLocation + ' · ' : ''}${rangeStr}${durationDays ? ` (${durationDays} Tage)` : ''}</span>
            </div>
          </div>
          <div class="vac-live-countdown" id="vac-modal-live-countdown">
            <span class="vac-cd-box"><strong id="vac-cd-days">--</strong><small>Tage</small></span>
            <span class="vac-cd-sep">:</span>
            <span class="vac-cd-box"><strong id="vac-cd-hours">--</strong><small>Std</small></span>
            <span class="vac-cd-sep">:</span>
            <span class="vac-cd-box"><strong id="vac-cd-mins">--</strong><small>Min</small></span>
            <span class="vac-cd-sep">:</span>
            <span class="vac-cd-box"><strong id="vac-cd-secs">--</strong><small>Sek</small></span>
          </div>
        </div>

        <!-- Planning Document Link Section -->
        <div class="detail-section-box">
          <div class="detail-section-title">
            <span>📝 Planungsdokument (Google Docs / Notion)</span>
          </div>
          <div id="vac-doc-container">
            ${docUrl ? `
              <div class="vac-doc-active-box">
                <a href="${docUrl}" target="_blank" class="detail-action-btn detail-action-primary vac-doc-btn">
                  <span>📄 Dokument öffnen</span>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
                <button class="detail-action-btn vac-doc-edit-btn" onclick="Holiday.promptDocLink('${dateKey}', '${docUrl.replace(/'/g, "\'")}')" title="Link bearbeiten">✏️</button>
              </div>
            ` : `
              <div class="vac-doc-placeholder-box">
                <button class="detail-action-btn vac-doc-add-btn" onclick="Holiday.promptDocLink('${dateKey}', '')">
                  + Link zu Google Docs / Sheets / Notion hinzufügen
                </button>
              </div>
            `}
          </div>
        </div>

        <!-- Destination Weather Forecast Section -->
        ${showWeather ? `
          <div class="detail-section-box" id="vac-weather-container">
            <div class="detail-section-title">
              <span>🌤️ Wetter & Klima (${destLocation})</span>
            </div>
            <div class="vac-weather-forecast-row" id="vac-weather-forecast-list">
              <div class="detail-notes-empty">Wetterdaten werden geladen...</div>
            </div>
          </div>
        ` : ''}

        <!-- Interactive Packing Checklist Section -->
        ${showPackingList ? renderPackingListSection(dateKey, destLocation || label) : ''}

        <!-- Currency Converter Section -->
        ${showCurrency ? `
          <div class="detail-section-box" id="vac-currency-container" style="display: none;">
            <div class="detail-section-title">
              <span>💱 Lokale Währung & Wechselkurs</span>
            </div>
            <div id="vac-currency-content" class="vac-currency-box"></div>
          </div>
        ` : ''}

        <!-- Actions Bar -->
        <div class="detail-actions-bar">
          <button class="detail-action-btn" onclick="Holiday.copyVacationDetails('${dateKey}', '${label.replace(/'/g, "\'")}', '${rangeStr}', '${destLocation.replace(/'/g, "\'")}', this)">
            📋 Reiseplan kopieren
          </button>
          <button class="detail-action-btn" onclick="Holiday.closeModal()">
            Schließen
          </button>
        </div>
      </div>
    `;

    const closeOnBackdrop = modalCfg.closeOnBackdrop !== false;
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('detail-close-btn') || (closeOnBackdrop && e.target === overlay)) {
        closeModal();
      }
    });

    const enableKeyboardNav = modalCfg.keyboardNav !== false;
    if (enableKeyboardNav) {
      _modalKeyHandler = (e) => {
        if (e.key === 'Escape') closeModal();
        else if (e.key === 'ArrowLeft') navigateModal(-1);
        else if (e.key === 'ArrowRight') navigateModal(1);
      };
      window.addEventListener('keydown', _modalKeyHandler);
    }

    // Auto-close on inactivity
    const autoCloseSec = modalCfg.autoCloseSeconds || 0;
    if (autoCloseSec > 0) {
      function resetTimer() {
        if (_autoCloseTimer) clearTimeout(_autoCloseTimer);
        _autoCloseTimer = setTimeout(closeModal, autoCloseSec * 1000);
      }
      resetTimer();
      overlay.addEventListener('pointerdown', resetTimer);
      overlay.addEventListener('touchstart', resetTimer);
      overlay.addEventListener('keydown', resetTimer);
    }

    document.body.appendChild(overlay);

    // Start precision live countdown timer
    updateLiveCountdown(vac.start);
    _countdownTimer = setInterval(() => updateLiveCountdown(vac.start), 1000);

    // Fetch live weather & currency
    if (showWeather && destLocation) {
      fetchDestinationWeather(destLocation, vac.start);
    }
    if (showCurrency && destLocation) {
      fetchDestinationCurrency(destLocation);
    }
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
    if (_autoCloseTimer) {
      clearTimeout(_autoCloseTimer);
      _autoCloseTimer = null;
    }
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
