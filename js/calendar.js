/**
 * Calendar module - parses ICS feed and displays today's events
 */
const Calendar = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.calendar;
    if (!config.icsUrl) {
      return; // placeholder text already in HTML
    }
    fetchEvents();
    refreshInterval = setInterval(fetchEvents, config.refreshMinutes * 60 * 1000);
  }

  async function fetchEvents() {
    const config = HOMEBOARD_CONFIG.calendar;

    try {
      const res = await fetch(config.icsUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const icsText = await res.text();
      const events = parseICS(icsText);
      render(events.slice(0, config.maxEvents));
    } catch (err) {
      console.error('Calendar fetch failed:', err);
      renderError();
    }
  }

  function parseICS(text) {
    const events = [];
    const lines = text.replace(/\r\n /g, '').split(/\r?\n/);
    let event = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        event = {};
      } else if (line === 'END:VEVENT' && event) {
        if (isToday(event.start)) {
          events.push(event);
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

    return events.sort((a, b) => (a.start || 0) - (b.start || 0));
  }

  function parseICSDate(str) {
    // Handles basic format: 20240101T120000Z or 20240101T120000
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

  function isToday(date) {
    if (!date) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
           date.getMonth() === now.getMonth() &&
           date.getDate() === now.getDate();
  }

  function render(events) {
    const list = document.getElementById('event-list');
    if (events.length === 0) {
      list.innerHTML = '<li class="event-placeholder">No events today</li>';
      return;
    }

    list.innerHTML = events.map(ev => {
      const time = ev.start
        ? `<span class="event-time">${ev.start.getHours().toString().padStart(2, '0')}:${ev.start.getMinutes().toString().padStart(2, '0')}</span>`
        : '';
      return `<li>${time}${ev.summary || 'Untitled'}</li>`;
    }).join('');
  }

  function renderError() {
    document.getElementById('event-list').innerHTML =
      '<li class="event-placeholder">Failed to load calendar</li>';
  }

  return { init };
})();
