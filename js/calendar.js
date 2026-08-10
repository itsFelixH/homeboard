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
      // Multi-day view: tabs + week overview
      renderMultiDay(icsText);
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
    // Show commute for any event with a location (assume local if no city specified)
    return true;
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
        let transitLegs = [];
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
                let legs = trips[0].LegList?.Leg || [];
                if (!Array.isArray(legs)) legs = [legs];
                transitLegs = legs.map(leg => {
                  const name = (leg.name || '').trim();
                  const dur = parsePTDuration(leg.duration);
                  const to = (leg.Destination?.name || '').replace(' (Berlin)', '').replace(' Bhf', '');
                  if (!name || name === 'Fußweg' || leg.type === 'WALK') {
                    return { type: 'walk', duration: dur };
                  }
                  return { type: 'transit', line: name, to, duration: dur };
                });
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
                const it = tData.itineraries[0];
                transitMin = Math.round(it.duration / 60);
                transitLegs = (it.legs || []).map(leg => {
                  const dur = Math.round((leg.duration || 0) / 60);
                  if (leg.mode === 'WALK') {
                    return { type: 'walk', duration: dur };
                  }
                  const line = leg.route || leg.routeShortName || leg.mode;
                  const to = (leg.to?.name || '').replace(' (Berlin)', '');
                  return { type: 'transit', line, to, duration: dur };
                });
              }
            }
          } catch (e) { /* skip */ }
        }

        // Update the rendered event with full commute info
        const eventEl = document.querySelector(`[data-event-idx="${i}"]`);
        if (eventEl && (bikeMin || transitMin)) {
          const commuteEl = eventEl.querySelector('.event-commute');
          if (commuteEl) {
            const now = new Date();
            const lang = Lang.get();

            // "Leave" badge next to event name
            const evStart = events[i].start;
            if (evStart && !events[i].allDay) {
              const bestTime = transitMin || bikeMin;
              const leaveAt = new Date(evStart.getTime() - bestTime * 60000);
              if (leaveAt > now) {
                const leaveInMin = Math.round((leaveAt - now) / 60000);
                let leaveBadge = '';
                if (leaveInMin <= 60) {
                  // Less than 1h: show "leave in X min"
                  leaveBadge = lang === 'de' ? `🚪 los in ${leaveInMin} min` : lang === 'es' ? `🚪 salir en ${leaveInMin} min` : `🚪 leave in ${leaveInMin} min`;
                } else {
                  // More than 1h: show "leave at HH:MM"
                  const leaveStr = `${leaveAt.getHours().toString().padStart(2,'0')}:${leaveAt.getMinutes().toString().padStart(2,'0')}`;
                  leaveBadge = lang === 'de' ? `🚪 los um ${leaveStr}` : lang === 'es' ? `🚪 salir a las ${leaveStr}` : `🚪 leave at ${leaveStr}`;
                }
                const untilEl = eventEl.querySelector('.event-until');
                if (untilEl) {
                  untilEl.textContent = leaveBadge;
                } else {
                  const row = eventEl.querySelector('.event-row');
                  if (row) row.insertAdjacentHTML('beforeend', `<span class="event-until">${leaveBadge}</span>`);
                }
              }
            }

            // Full route display with walk segments and destinations
            let routeHtml = '';
            if (transitMin && transitLegs.length > 0) {
              const legParts = transitLegs.map(leg => {
                if (leg.type === 'walk') {
                  return `<span class="event-route-walk">🚶${leg.duration}′</span>`;
                }
                const toLabel = leg.to ? ` → ${leg.to}` : '';
                return `<span class="event-route-leg">${leg.line}</span><span class="event-route-to">${toLabel}</span>`;
              }).join('');
              routeHtml += `<div class="event-route-line">🚋 ${transitMin} min · ${legParts}</div>`;
            } else if (transitMin) {
              routeHtml += `<div class="event-route-line">🚋 ${transitMin} min</div>`;
            }
            if (bikeMin) {
              routeHtml += `<div class="event-route-line">🚲 ${bikeMin} min · ${bikeKm} km</div>`;
            }
            commuteEl.innerHTML = routeHtml;
          }
        }
      } catch (err) {
        // Silently skip failed geocoding
      }
    }
  }

  let _multiDayCache = []; // cached events per day [{date, label, events}]
  let _selectedDay = 0;   // 0=today, 1=tomorrow, 2=day after

  function renderMultiDay(icsText) {
    const config = HOMEBOARD_CONFIG.calendar;
    const lines = icsText.replace(/\r\n /g, '').split(/\r?\n/);
    const today = new Date();
    const dowMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const lang = Lang.get();
    const dayNamesShort = lang === 'de'
      ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      : lang === 'es'
      ? ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const patterns = (config.hidePatterns || []).map(p => new RegExp(p, 'i'));

    // Parse events for next 7 days
    _multiDayCache = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
      const dateStr = dateToStr(date);
      const dow = date.getDay();

      let event = null;
      const dayEvents = [];

      for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
          event = { exdates: [] };
        } else if (line === 'END:VEVENT' && event) {
          if (event.summary && event.start) {
            if (occursToday(event, dateStr, dow, date, dowMap)) {
              if (!patterns.some(re => re.test(event.summary || ''))) {
                dayEvents.push(event);
              }
            }
          }
          event = null;
        } else if (event) {
          if (line.startsWith('DTSTART')) { const p = parseDT(line); event.start = p.date; event.allDay = p.allDay; }
          else if (line.startsWith('DTEND')) { event.end = parseDT(line).date; }
          else if (line.startsWith('SUMMARY')) { event.summary = line.split(':').slice(1).join(':'); }
          else if (line.startsWith('LOCATION')) { event.location = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\'); }
          else if (line.startsWith('RRULE')) { event.rrule = parseRRULE(line); }
          else if (line.startsWith('EXDATE')) { event.exdates.push(line.split(':').pop().slice(0, 8)); }
        }
      }

      dayEvents.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return (a.start || 0) - (b.start || 0);
      });

      let label;
      if (d === 0) label = lang === 'de' ? 'Heute' : lang === 'es' ? 'Hoy' : 'Today';
      else if (d === 1) label = lang === 'de' ? 'Morgen' : lang === 'es' ? 'Mañana' : 'Tomorrow';
      else label = dayNamesShort[dow];

      _multiDayCache.push({ date, label, dayName: dayNamesShort[dow], events: dayEvents });
    }

    renderDayTabs();
    renderWeekStrip();
  }

  function switchDay(idx) {
    _selectedDay = idx;
    renderDayTabs();
    // Re-render main event list for selected day
    const config = HOMEBOARD_CONFIG.calendar;
    const dayData = _multiDayCache[idx];
    if (dayData) {
      render(dayData.events.slice(0, config.maxEvents));
      // Update card header title
      const headerLabel = document.querySelector('.card-calendar .card-header span[data-i18n="calendar_title"]');
      if (headerLabel) headerLabel.textContent = dayData.label;
    }
  }

  function renderDayTabs() {
    const previewEl = document.getElementById('calendar-tomorrow');
    if (!previewEl) return;

    // Show tabs for first 3 days
    const tabs = _multiDayCache.slice(0, 3).map((day, i) => {
      const active = i === _selectedDay ? ' cal-tab-active' : '';
      const count = day.events.length;
      const badge = count > 0 ? `<span class="cal-tab-count">${count}</span>` : '';
      return `<button class="cal-tab${active}" onclick="Calendar.switchDay(${i})">${day.label} ${badge}</button>`;
    }).join('');

    previewEl.innerHTML = `<div class="cal-tabs">${tabs}</div>`;
  }

  function renderWeekStrip() {
    const previewEl = document.getElementById('calendar-tomorrow');
    if (!previewEl) return;

    // Mini week overview: 7 days with dots
    const stripHtml = _multiDayCache.map((day, i) => {
      const isToday = i === 0;
      const isSelected = i === _selectedDay;
      const dots = Math.min(day.events.length, 4);
      const dotHtml = dots > 0
        ? Array(dots).fill('<span class="cal-week-dot"></span>').join('')
        : '<span class="cal-week-dot cal-week-dot-empty"></span>';
      return `<div class="cal-week-day ${isToday ? 'cal-week-today' : ''} ${isSelected ? 'cal-week-selected' : ''}" onclick="Calendar.switchDay(${i})">
        <span class="cal-week-name">${day.dayName}</span>
        <span class="cal-week-date">${day.date.getDate()}</span>
        <div class="cal-week-dots">${dotHtml}</div>
      </div>`;
    }).join('');

    previewEl.innerHTML += `<div class="cal-week-strip">${stripHtml}</div>`;
  }

  function render(events) {
    const list = document.getElementById('event-list');
    if (events.length === 0) {
      list.innerHTML = `<li class="event-placeholder">${i18n('calendar_no_events')}</li>`;
      return;
    }

    const now = new Date();
    const allDay = events.filter(ev => ev.allDay);
    const timed = events.filter(ev => !ev.allDay);

    // All-day events as pills at the top
    const allDayHtml = allDay.length > 0
      ? `<li class="event-allday-row">${allDay.map(ev => {
          const mapsUrl = ev.location ? `https://maps.google.com/?q=${encodeURIComponent(ev.location)}` : '';
          return mapsUrl
            ? `<a href="${mapsUrl}" target="_blank" class="event-allday-pill" title="${ev.location}">${ev.summary || 'Untitled'}</a>`
            : `<span class="event-allday-pill">${ev.summary || 'Untitled'}</span>`;
        }).join('')}</li>`
      : '';

    // Timed events with "in X min" badge
    const timedHtml = timed.map((ev, i) => {
      const idx = allDay.length + i; // preserve data-event-idx across full list
      const actualIdx = events.indexOf(ev);

      const timeStr = `${ev.start.getHours().toString().padStart(2,'0')}:${ev.start.getMinutes().toString().padStart(2,'0')}`;
      const timeHtml = `<span class="event-time">${timeStr}</span>`;

      // Time-until badge
      const diffMin = Math.round((ev.start - now) / 60000);
      let untilHtml = '';
      if (diffMin > 0 && diffMin <= 90) {
        untilHtml = `<span class="event-until">in ${diffMin} min</span>`;
      } else if (diffMin > 0 && diffMin <= 180) {
        const hrs = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        untilHtml = `<span class="event-until">in ${hrs}h${mins > 0 ? ` ${mins}m` : ''}</span>`;
      }

      const locationHtml = ev.location && isBerlinLocation(ev.location)
        ? `<div class="event-commute" title="${ev.location}"></div>`
        : '';

      const mapsUrl = ev.location ? `https://maps.google.com/?q=${encodeURIComponent(ev.location)}` : '';
      const summaryHtml = mapsUrl
        ? `<a href="${mapsUrl}" target="_blank" class="event-summary event-summary-link" title="${ev.location}">${ev.summary || 'Untitled'}</a>`
        : `<span class="event-summary">${ev.summary || 'Untitled'}</span>`;

      return `<li data-event-idx="${actualIdx}"><div class="event-row">${timeHtml}${summaryHtml}${untilHtml}</div>${locationHtml}</li>`;
    }).join('');

    list.innerHTML = allDayHtml + timedHtml;
  }

  function parsePTDuration(str) {
    if (!str) return null;
    const h = str.match(/(\d+)H/);
    const m = str.match(/(\d+)M/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }

  return { init, switchDay };
})();
