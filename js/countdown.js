/**
 * Countdown module - finds the next 2-3 "🏝️ Urlaub" events from the calendar
 * and shows days remaining until each starts.
 */
const Countdown = (() => {
  let refreshInterval;
  const MAX_VACATIONS = 3;

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

  function renderAll(vacations) {
    const container = document.getElementById('countdown-list');
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
        sublabel = diffDays === 1
          ? (i18n('countdown_day') || 'day to go')
          : (i18n('countdown_days') || 'days to go');
      }

      // Check for custom name in config
      const dateKey = `${vac.start.getFullYear()}-${String(vac.start.getMonth()+1).padStart(2,'0')}-${String(vac.start.getDate()).padStart(2,'0')}`;
      const names = HOMEBOARD_CONFIG.countdown?.names || {};
      const label = names[dateKey] || vac.summary || 'Urlaub';
      const dateStr = vac.start.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

      return `<div class="countdown-item">
        <span class="countdown-days">${daysText}</span>
        <div class="countdown-meta">
          <span class="countdown-label">${label}</span>
          <span class="countdown-sublabel">${dateStr} · ${sublabel}</span>
        </div>
      </div>`;
    }).join('');
  }

  return { init };
})();
