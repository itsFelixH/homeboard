/**
 * Trash schedule module - parses BSR ICS calendar
 * Get your ICS from: https://www.bsr.de/abfuhrkalender-20520.php
 * Enter your address, download the .ics file, host it or use a URL
 *
 * Alternatively, manually configure pickup days in config.
 */
const Trash = (() => {
  let refreshInterval;

  // Bin type emoji mapping
  const BIN_ICONS = {
    'restmüll': '⚫',
    'rest': '⚫',
    'hausmüll': '⚫',
    'bio': '🟤',
    'biotonne': '🟤',
    'papier': '🔵',
    'wertstoff': '🟡',
    'gelbe': '🟡',
    'glas': '🟢',
    'laub': '🟠'
  };

  function init() {
    const config = HOMEBOARD_CONFIG.trash;
    if (!config) {
      document.getElementById('trash-next').textContent = 'Not configured';
      return;
    }

    if (config.icsUrl) {
      fetchICS();
      refreshInterval = setInterval(fetchICS, 6 * 60 * 60 * 1000); // every 6h
    } else if (config.schedule && config.schedule.length > 0) {
      renderManual(config.schedule);
    } else {
      document.getElementById('trash-next').textContent = 'Set ICS URL in config';
    }
  }

  async function fetchICS() {
    const config = HOMEBOARD_CONFIG.trash;

    try {
      const res = await fetch(config.icsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const icsText = await res.text();
      const events = parseICS(icsText);
      render(events);
    } catch (err) {
      console.error('Trash schedule fetch failed:', err);
      document.getElementById('trash-next').textContent = 'Error loading schedule';
    }
  }

  function parseICS(text) {
    const events = [];
    const lines = text.replace(/\r\n /g, '').split(/\r?\n/);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let event = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        event = {};
      } else if (line === 'END:VEVENT' && event) {
        if (event.start && event.start >= todayMidnight) {
          events.push(event);
        }
        event = null;
      } else if (event) {
        if (line.startsWith('DTSTART')) {
          event.start = parseDate(line.split(':').pop());
        } else if (line.startsWith('SUMMARY')) {
          event.summary = line.split(':').slice(1).join(':');
        }
      }
    }

    return events.sort((a, b) => a.start - b.start);
  }

  function parseDate(str) {
    if (!str) return null;
    const clean = str.replace(/[^0-9T]/g, '');
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));
    return new Date(year, month, day);
  }

  function render(events) {
    const container = document.getElementById('trash-list');
    const lang = Lang.get();
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (events.length === 0) {
      document.getElementById('trash-next').textContent = lang === 'de' ? 'Keine Abholungen' : 'No upcoming pickups';
      container.innerHTML = '';
      return;
    }

    // Next pickup summary
    const next = events[0];
    const daysUntil = Math.ceil((next.start - now) / (1000 * 60 * 60 * 24));
    let dayLabel;
    if (daysUntil === 0) dayLabel = lang === 'de' ? 'Heute' : lang === 'es' ? 'Hoy' : 'Today';
    else if (daysUntil === 1) dayLabel = lang === 'de' ? 'Morgen' : lang === 'es' ? 'Mañana' : 'Tomorrow';
    else dayLabel = lang === 'de' ? `In ${daysUntil} Tagen` : lang === 'es' ? `En ${daysUntil} días` : `In ${daysUntil} days`;
    const nextLabel = lang === 'de' ? 'Nächste' : lang === 'es' ? 'Próxima' : 'Next';
    document.getElementById('trash-next').textContent = `${nextLabel}: ${dayLabel}`;

    // Calendar week view: next 7 days
    const dayNames = lang === 'de'
      ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayMidnight.getTime() + i * 86400000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dayEvents = events.filter(ev => {
        const evDate = `${ev.start.getFullYear()}-${String(ev.start.getMonth()+1).padStart(2,'0')}-${String(ev.start.getDate()).padStart(2,'0')}`;
        return evDate === dateStr;
      });
      days.push({
        name: dayNames[d.getDay()],
        date: d.getDate(),
        isToday: i === 0,
        bins: dayEvents.map(ev => getIcon(ev.summary))
      });
    }

    container.innerHTML = `<div class="trash-calendar">
      ${days.map(d => `<div class="trash-cal-day ${d.isToday ? 'trash-cal-today' : ''}">
        <span class="trash-cal-name">${d.name}</span>
        <span class="trash-cal-date">${d.date}</span>
        <div class="trash-cal-bins">${d.bins.length > 0 ? d.bins.join('') : '<span class="trash-cal-empty">·</span>'}</div>
      </div>`).join('')}
    </div>`;
  }

  function renderManual(schedule) {
    // For manually configured schedules
    const container = document.getElementById('trash-list');
    container.innerHTML = schedule.map(item => {
      const icon = getIcon(item.type);
      return `<div class="trash-item">
        <span class="trash-icon">${icon}</span>
        <span class="trash-type">${item.type}</span>
        <span class="trash-date">${item.day}</span>
      </div>`;
    }).join('');
  }

  function getIcon(summary) {
    if (!summary) return '🗑️';
    const lower = summary.toLowerCase();
    for (const [key, icon] of Object.entries(BIN_ICONS)) {
      if (lower.includes(key)) return icon;
    }
    return '🗑️';
  }

  return { init };
})();
