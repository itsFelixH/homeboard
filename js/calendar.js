/**
 * Calendar module - parses ICS feed and displays today's events
 * Features: RRULE support, event filtering, commute time for Berlin locations
 */
const Calendar = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.calendar;
    if (!config.icsUrl) {
      document.getElementById('event-list').innerHTML =
        `<li class="event-placeholder">${i18n('calendar_no_events')}</li>`;
      return;
    }
    fetchEvents();
    refreshInterval = setInterval(fetchEvents, config.refreshMinutes * 60 * 1000);
  }

  async function fetchEvents() {
    const config = HOMEBOARD_CONFIG.calendar;
    try {
      const url = `/proxy?url=${encodeURIComponent(config.icsUrl)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const icsText = await res.text();
      window._calendarCache = icsText;
      let events = parseICS(icsText);
      events = filterEvents(events);
      render(events.slice(0, config.maxEvents));
      // Fetch commute for events with locations
      if (config.showCommute) {
        fetchCommuteForEvents(events.slice(0, config.maxEvents));
      }
    } catch (err) {
      console.error('Calendar fetch failed:', err);
      document.getElementById('event-list').innerHTML =
        '<li class="event-placeholder">Failed to load</li>';
    }
  }

  function filterEvents(events) {
    const config = HOMEBOARD_CONFIG.calendar;
    const patterns = (config.hidePatterns || []).map(p => new RegExp(p, 'i'));
    if (patterns.length === 0) return events;
    return events.filter(ev => {
      return !patterns.some(re => re.test(ev.summary || ''));
    });
  }

  function parseICS(text) {
    const events = [];
    const lines = text.replace(/\r\n /g, '').split(/\r?\n/);
    const today = new Date();
    const todayStr = dateToStr(today);
    const todayDow = today.getDay();
    const dowMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

    let event = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        event = { exdates: [] };
      } else if (line === 'END:VEVENT' && event) {
        if (event.summary && event.start) {
          if (occursToday(event, todayStr, todayDow, today, dowMap)) {
            events.push(event);
          }
        }
        event = null;
      } else if (event) {
        if (line.startsWith('DTSTART')) {
          const p = parseDT(line);
          event.start = p.date;
          event.allDay = p.allDay;
        } else if (line.startsWith('DTEND')) {
          event.end = parseDT(line).date;
        } else if (line.startsWith('SUMMARY')) {
          event.summary = line.split(':').slice(1).join(':');
        } else if (line.startsWith('LOCATION')) {
          event.location = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        } else if (line.startsWith('RRULE')) {
          event.rrule = parseRRULE(line);
        } else if (line.startsWith('EXDATE')) {
          event.exdates.push(line.split(':').pop().slice(0, 8));
        }
      }
    }

    return events.sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return (a.start || 0) - (b.start || 0);
    });
  }

  function parseDT(line) {
    const allDay = line.includes('VALUE=DATE');
    const value = line.split(':').pop();
    const clean = value.replace(/[^0-9T]/g, '');
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));

    if (allDay || clean.length <= 8) {
      return { date: new Date(year, month, day), allDay: true };
    }

    const hour = parseInt(clean.slice(9, 11)) || 0;
    const minute = parseInt(clean.slice(11, 13)) || 0;

    if (value.endsWith('Z')) {
      return { date: new Date(Date.UTC(year, month, day, hour, minute)), allDay: false };
    }
    return { date: new Date(year, month, day, hour, minute), allDay: false };
  }

  function parseRRULE(line) {
    const parts = line.split(':').pop().split(';');
    const rule = {};
    for (const part of parts) {
      const [key, val] = part.split('=');
      if (key && val) rule[key] = val;
    }
    return rule;
  }

  function occursToday(event, todayStr, todayDow, today, dowMap) {
    const startStr = dateToStr(event.start);
    if (event.exdates.includes(todayStr)) return false;
    if (startStr === todayStr) return true;

    if (event.allDay && event.end) {
      const endStr = dateToStr(event.end);
      if (todayStr >= startStr && todayStr < endStr) return true;
    }

    if (!event.rrule) return false;
    const rule = event.rrule;
    const freq = rule.FREQ;
    if (event.start > today) return false;

    if (rule.UNTIL) {
      const untilClean = rule.UNTIL.replace(/[^0-9]/g, '').slice(0, 8);
      if (untilClean < todayStr) return false;
    }

    if (rule.COUNT) {
      const count = parseInt(rule.COUNT);
      const interval = parseInt(rule.INTERVAL || '1');
      if (freq === 'WEEKLY') {
        const weeks = Math.floor((today - event.start) / (7 * 86400000));
        if (weeks / interval >= count) return false;
      } else if (freq === 'DAILY') {
        const days = Math.floor((today - event.start) / 86400000);
        if (days / interval >= count) return false;
      } else if (freq === 'MONTHLY') {
        const months = (today.getFullYear() - event.start.getFullYear()) * 12 + (today.getMonth() - event.start.getMonth());
        if (months / interval >= count) return false;
      } else if (freq === 'YEARLY') {
        if (today.getFullYear() - event.start.getFullYear() >= count) return false;
      }
    }

    if (freq === 'WEEKLY') {
      const interval = parseInt(rule.INTERVAL || '1');
      // Check if this week matches the interval
      const weeksDiff = Math.round((today - event.start) / (7 * 86400000));
      if (weeksDiff % interval !== 0) return false;
      const byDay = rule.BYDAY ? rule.BYDAY.split(',') : [];
      if (byDay.length > 0) return byDay.some(d => dowMap[d] === todayDow);
      return event.start.getDay() === todayDow;
    }
    if (freq === 'DAILY') {
      const interval = parseInt(rule.INTERVAL || '1');
      return Math.round((today - event.start) / 86400000) % interval === 0;
    }
    if (freq === 'MONTHLY') return event.start.getDate() === today.getDate();
    if (freq === 'YEARLY') return event.start.getMonth() === today.getMonth() && event.start.getDate() === today.getDate();

    return false;
  }

  function dateToStr(d) {
    if (!d) return '';
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }

  function isBerlinLocation(loc) {
    if (!loc) return false;
    const lower = loc.toLowerCase();
    return lower.includes('berlin') || /\b10\d{3}\b/.test(loc) || /\b12\d{3}\b/.test(loc) || /\b13\d{3}\b/.test(loc) || /\b14\d{3}\b/.test(loc);
  }

  async function fetchCommuteForEvents(events) {
    const origin = HOMEBOARD_CONFIG.location;
    if (!origin.latitude || !origin.longitude) return;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev.location || !isBerlinLocation(ev.location)) continue;

      try {
        // Geocode the location using Nominatim (via proxy for proper User-Agent)
        const geoUrl = `/proxy?url=${encodeURIComponent(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(ev.location)}`)}`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) continue;
        const geoData = await geoRes.json();
        if (!geoData.length) continue;

        const destLat = parseFloat(geoData[0].lat);
        const destLon = parseFloat(geoData[0].lon);

        // Bike time via OSRM
        const bikeUrl = `https://router.project-osrm.org/route/v1/cycling/${origin.longitude},${origin.latitude};${destLon},${destLat}?overview=false`;
        const bikeRes = await fetch(bikeUrl);
        let bikeMin = null;
        let bikeKm = null;
        if (bikeRes.ok) {
          const bikeData = await bikeRes.json();
          if (bikeData.code === 'Ok' && bikeData.routes.length) {
            bikeMin = Math.round((bikeData.routes[0].duration / 60) * 1.5);
            bikeKm = (bikeData.routes[0].distance / 1000).toFixed(1);
          }
        }

    // Fetch transit via HAFAS
        let transitMin = null;
        const hafasKey = HOMEBOARD_CONFIG.departures?.hafasAccessId;
        if (hafasKey) {
          try {
            const hafasUrl = `https://vbb.demo.hafas.cloud/api/fahrinfo/latest/trip?` +
              `accessId=${hafasKey}` +
              `&originCoordLat=${origin.latitude}&originCoordLong=${origin.longitude}` +
              `&destCoordLat=${destLat}&destCoordLong=${destLon}` +
              `&format=json&numF=1`;
            const hafasRes = await fetch(hafasUrl);
            if (hafasRes.ok) {
              const hData = await hafasRes.json();
              const trips = hData.Trip || [];
              if (trips.length > 0) {
                transitMin = parsePTDuration(trips[0].duration);
              }
            }
          } catch (e) { /* skip */ }
        }

        // Fallback to Transitous
        if (!transitMin) {
          try {
            const transitUrl = `https://api.transitous.org/api/v1/plan?` +
              `fromPlace=${origin.latitude},${origin.longitude}` +
              `&toPlace=${destLat},${destLon}` +
              `&mode=TRANSIT,WALK&numItineraries=1`;
            const transitRes = await fetch(transitUrl);
            if (transitRes.ok) {
              const tData = await transitRes.json();
              if (tData.itineraries?.length > 0) {
                transitMin = Math.round(tData.itineraries[0].duration / 60);
              }
            }
          } catch (e) { /* skip */ }
        }

        // Update the rendered event with commute info
        const eventEl = document.querySelector(`[data-event-idx="${i}"]`);
        if (eventEl && (bikeMin || transitMin)) {
          const commuteEl = eventEl.querySelector('.event-commute');
          if (commuteEl) {
            const parts = [];
            if (transitMin) parts.push(`🚋 ${transitMin}′`);
            if (bikeMin) parts.push(`🚲 ${bikeMin}′ · ${bikeKm} km`);
            commuteEl.textContent = parts.join('  ');
          }
        }
      } catch (err) {
        // Silently skip failed geocoding
      }
    }
  }

  function render(events) {
    const list = document.getElementById('event-list');
    if (events.length === 0) {
      list.innerHTML = `<li class="event-placeholder">${i18n('calendar_no_events')}</li>`;
      return;
    }

    list.innerHTML = events.map((ev, idx) => {
      const time = (!ev.allDay && ev.start)
        ? `<span class="event-time">${ev.start.getHours().toString().padStart(2,'0')}:${ev.start.getMinutes().toString().padStart(2,'0')}</span>`
        : '';

      const locationHtml = ev.location && isBerlinLocation(ev.location)
        ? `<span class="event-commute" title="${ev.location}"></span>`
        : '';

      // Make location clickable (Google Maps)
      const locationLink = ev.location
        ? `<a href="https://maps.google.com/?q=${encodeURIComponent(ev.location)}" target="_blank" class="event-location-link" title="${ev.location}">📍</a>`
        : '';

      return `<li data-event-idx="${idx}">${time}${ev.summary || 'Untitled'} ${locationLink}${locationHtml}</li>`;
    }).join('');
  }

  function parsePTDuration(str) {
    if (!str) return null;
    const h = str.match(/(\d+)H/);
    const m = str.match(/(\d+)M/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }

  return { init };
})();
