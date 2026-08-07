/**
 * Countdown module - finds the next 2-3 "🏝️ Urlaub" events from the calendar
 * and shows days remaining until each starts.
 * Click on a vacation name to rename it (saved in localStorage).
 */
const Holiday = (() => {
  let refreshInterval;
  const MAX_VACATIONS = 3;
  const STORAGE_KEY = 'homeboard_countdown_names';

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

  function getCustomNames() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveCustomName(dateKey, name) {
    const names = getCustomNames();
    if (name && name.trim()) {
      names[dateKey] = name.trim();
    } else {
      delete names[dateKey];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
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
        if (event.summary && event.summary.includes('Urlaub') && event.start) {
          const eventMidnight = new Date(
            event.start.getFullYear(),
            event.start.getMonth(),
            event.start.getDate()
          );
          if (eventMidnight >= todayMidnight) {
            candidates.push(event);
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
    return candidates.slice(0, MAX_VACATIONS);
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

  function renderAll(vacations) {
    const container = document.getElementById('countdown-list');
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const customNames = getCustomNames();
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
      if (diffDays < 0) {
        daysText = '\u2714';
        sublabel = i18n('countdown_started') || 'Already started!';
      } else if (diffDays === 0) {
        daysText = '\uD83C\uDF89';
        sublabel = i18n('countdown_today') || 'Today!';
      } else {
        daysText = diffDays;
        sublabel = '';
      }

      const dateKey = makeDateKey(vac.start);
      const label = customNames[dateKey] || configNames[dateKey] || vac.summary || 'Urlaub';
      const dateStr = vac.start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

      return `<div class="countdown-item">
        <span class="countdown-days">${daysText}</span>
        <div class="countdown-meta">
          <span class="countdown-label" data-date-key="${dateKey}" title="Click to rename">${label}</span>
          <span class="countdown-sublabel">${dateStr}${sublabel ? ' · ' + sublabel : ''}</span>
        </div>
      </div>`;
    }).join('');

    // Bind click-to-edit on labels
    container.querySelectorAll('.countdown-label[data-date-key]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const dateKey = el.getAttribute('data-date-key');
        startEdit(dateKey, el.textContent, el);
      });
    });
  }

  return { init };
})();
