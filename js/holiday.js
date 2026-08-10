/**
 * Countdown module - finds the next 2-3 "🏝️ Urlaub" events from the calendar
 * and shows days remaining until each starts.
 * Click on a vacation name to rename it (saved in localStorage).
 */
const Holiday = (() => {
  let refreshInterval;
  const MAX_VACATIONS = () => (HOMEBOARD_CONFIG.countdown && HOMEBOARD_CONFIG.countdown.maxVacations) || 3;
  const STATE_KEY = 'countdown_names';

  function init() {
    const calConfig = HOMEBOARD_CONFIG.calendar;
    if (!calConfig.icsUrl) {
      showFallback();
      return;
    }
    // Wait a moment for Calendar module to fetch first (shared cache)
    setTimeout(fetchAndFind, 2000);
    refreshInterval = setInterval(fetchAndFind, 60 * 60 * 1000);
  }

  async function getCustomNames() {
    const names = await State.get(STATE_KEY);
    return (names && typeof names === 'object') ? names : {};
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
      document.getElementById('countdown-list').innerHTML =
        `<div class="countdown-empty">${i18n('countdown_none') || 'No vacation found'}</div>`;
    }
  }

  async function fetchAndFind() {
    const calConfig = HOMEBOARD_CONFIG.calendar;

    try {
      // Use cached calendar data if available (already fetched by Calendar module)
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
          if (event.summary.includes(keyword)) {
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
        } else if (line.startsWith('SUMMARY')) {
          event.summary = line.split(':').slice(1).join(':');
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

  function startEdit(dateKey, currentLabel, labelEl) {
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
    const container = document.getElementById('countdown-list');
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
      const lang = Lang.get();
      if (diffDays < 0) {
        daysText = '\u2714';
        sublabel = i18n('countdown_started') || 'Already started!';
      } else if (diffDays === 0) {
        daysText = '\uD83C\uDF89';
        sublabel = i18n('countdown_today') || 'Today!';
      } else if (diffDays === 1) {
        daysText = diffDays;
        sublabel = lang === 'de' ? '🧳 Koffer packen!' : '🧳 Pack your bags!';
      } else if (diffDays <= 3) {
        daysText = diffDays;
        sublabel = lang === 'de' ? '✈️ Bald gehts los!' : '✈️ Almost there!';
      } else {
        daysText = diffDays;
        sublabel = '';
      }

      const dateKey = makeDateKey(vac.start);
      const label = customNames[dateKey] || configNames[dateKey] || vac.summary || 'Urlaub';
      const dateStr = vac.start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

      // Google Calendar week view link for this vacation date
      const calWeekUrl = `https://calendar.google.com/calendar/r/week/${vac.start.getFullYear()}/${vac.start.getMonth()+1}/${vac.start.getDate()}`;

      return `<div class="countdown-item">
        <a href="${calWeekUrl}" target="_blank" class="countdown-link-wrap">
          <span class="countdown-days">${daysText}</span>
          <div class="countdown-meta">
            <span class="countdown-label" data-date-key="${dateKey}">${label}</span>
            <span class="countdown-sublabel">${dateStr}${sublabel ? ' · ' + sublabel : ''}</span>
          </div>
        </a>
        <button class="countdown-edit-btn" data-date-key="${dateKey}" title="Rename" aria-label="Rename">✏️</button>
      </div>`;
    }).join('');

    // Bind edit button click
    container.querySelectorAll('.countdown-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateKey = btn.getAttribute('data-date-key');
        const labelEl = btn.parentNode.querySelector(`.countdown-label[data-date-key="${dateKey}"]`);
        if (labelEl) startEdit(dateKey, labelEl.textContent, labelEl);
      });
    });
  }

  return { init };
})();
