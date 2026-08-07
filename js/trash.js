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
    const upcoming = events.slice(0, 4);
    const container = document.getElementById('trash-list');

    if (upcoming.length === 0) {
      document.getElementById('trash-next').textContent = 'No upcoming pickups';
      container.innerHTML = '';
      return;
    }

    // Next pickup summary
    const next = upcoming[0];
    const daysUntil = Math.ceil((next.start - new Date()) / (1000 * 60 * 60 * 24));
    const dayLabel = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`;
    document.getElementById('trash-next').textContent = `Next: ${dayLabel}`;

    // List upcoming
    container.innerHTML = upcoming.map(ev => {
      const icon = getIcon(ev.summary);
      // Clean up summary - remove common prefixes
      let label = ev.summary || '';
      label = label
        .replace(/^Abholung\s*/i, '')
        .replace(/^Leerung\s*/i, '')
        .trim();
      const date = ev.start.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
      return `<div class="trash-item">
        <span class="trash-icon">${icon}</span>
        <span class="trash-type">${label}</span>
        <span class="trash-date">${date}</span>
      </div>`;
    }).join('');
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
