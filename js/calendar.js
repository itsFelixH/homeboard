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
          event.summary = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        } else if (line.startsWith('LOCATION')) {
          event.location = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        } else if (line.startsWith('DESCRIPTION')) {
          event.description = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
        } else if (line.startsWith('ATTENDEE')) {
          if (!event.attendees) event.attendees = [];
          const cn = line.match(/CN=([^;:]+)/i);
          if (cn) event.attendees.push(cn[1].replace(/"/g, ''));
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
    const matches = checkOccursToday(event, todayStr, todayDow, today, dowMap);
    if (matches) {
      const targetYear = today.getFullYear();
      const targetMonth = today.getMonth();
      const targetDate = today.getDate();

      const startHrs = event.start.getHours();
      const startMins = event.start.getMinutes();
      const startSecs = event.start.getSeconds();
      const startMs = event.start.getMilliseconds();
      const originalStart = event.start;

      event.start = new Date(targetYear, targetMonth, targetDate, startHrs, startMins, startSecs, startMs);

      if (event.end) {
        const durationMs = event.end - originalStart;
        event.end = new Date(event.start.getTime() + durationMs);
      }
    }
    return matches;
  }

  function checkOccursToday(event, todayStr, todayDow, today, dowMap) {
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

  function isHomeAddress(location) {
    if (!location) return false;
    const homeAddr = HOMEBOARD_CONFIG.location.address;
    if (!homeAddr) return false;
    const normalize = s => s.toLowerCase().replace(/[.,\-\/\\]/g, ' ').replace(/\s+/g, ' ').trim();
    const loc = normalize(location);
    const home = normalize(homeAddr);
    return loc.includes(home) || home.includes(loc);
  }

  function isEventEnded(ev) {
    const now = new Date();
    if (ev.end) return ev.end <= now;
    // No end time: treat as ended if start is in the past (for timed events)
    if (!ev.allDay && ev.start) return ev.start <= now;
    return false;
  }

  async function fetchCommuteForEvents(events) {
    const origin = HOMEBOARD_CONFIG.location;
    if (!origin.latitude || !origin.longitude) return;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev.location || !isBerlinLocation(ev.location)) continue;
      if (isHomeAddress(ev.location)) continue;
      if (isEventEnded(ev)) continue;

      try {
        // Geocode the location — check cache first, then Nominatim, then Photon
        let destLat = null, destLon = null;
        const locStr = ev.location;
        const cacheKey = `geo_${locStr}`;

        // Check sessionStorage cache
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const coords = JSON.parse(cached);
            destLat = coords.lat;
            destLon = coords.lon;
          }
        } catch (e) { /* ignore */ }

        if (!destLat || !destLon) {
          const queries = [locStr];
          // Extract street address: try after first comma, or just last parts
          const parts = locStr.split(',').map(s => s.trim());
          if (parts.length >= 2) {
            queries.push(parts.slice(1).join(', ')); // skip business name
          }
          if (parts.length >= 3) {
            queries.push(parts.slice(-2).join(', ')); // just city + zip
          }

          // Try Nominatim
          for (const q of queries) {
            const geoUrl = `/proxy?url=${encodeURIComponent(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)}`;
            const geoRes = await fetch(geoUrl);
            if (!geoRes.ok) continue;
            const geoData = await geoRes.json();
            if (geoData.length) {
              destLat = parseFloat(geoData[0].lat);
              destLon = parseFloat(geoData[0].lon);
              break;
            }
          }

          // Fallback: Photon (Komoot) geocoder
          if (!destLat) {
            for (const q of queries) {
              try {
                const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1&lang=de`;
                const photonRes = await fetch(photonUrl);
                if (!photonRes.ok) continue;
                const photonData = await photonRes.json();
                if (photonData.features && photonData.features.length) {
                  const [lon, lat] = photonData.features[0].geometry.coordinates;
                  destLat = lat;
                  destLon = lon;
                  break;
                }
              } catch (e) { /* skip */ }
            }
          }

          // Cache result
          if (destLat && destLon) {
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ lat: destLat, lon: destLon })); } catch (e) { /* full */ }
          }
        }

        if (!destLat || !destLon) continue;

        // Bike time via OSRM
        const bikeUrl = `https://router.project-osrm.org/route/v1/cycling/${origin.longitude},${origin.latitude};${destLon},${destLat}?overview=false`;
        const bikeRes = await fetch(bikeUrl);
        let bikeMin = null;
        let bikeKm = null;
        if (bikeRes.ok) {
          const bikeData = await bikeRes.json();
          if (bikeData.code === 'Ok' && bikeData.routes.length) {
            const distM = bikeData.routes[0].distance;
            bikeKm = (distM / 1000).toFixed(1);
            // Calculate from distance at configured bike speed
            const bikeSpeedMpm = ((HOMEBOARD_CONFIG.commute && HOMEBOARD_CONFIG.commute.bikeSpeed) || 13) * 1000 / 60;
            bikeMin = Math.round(distM / bikeSpeedMpm);
          }
        }

        // Fetch walking route via OSRM
        let walkMin = null;
        let walkKm = null;
        try {
          const walkUrl = `https://router.project-osrm.org/route/v1/foot/${origin.longitude},${origin.latitude};${destLon},${destLat}?overview=false`;
          const walkRes = await fetch(walkUrl);
          if (walkRes.ok) {
            const walkData = await walkRes.json();
            if (walkData.code === 'Ok' && walkData.routes.length) {
              const distM = walkData.routes[0].distance;
              walkKm = (distM / 1000).toFixed(1);
              // Calculate from distance at configured walk speed
              const walkSpeedMpm = ((HOMEBOARD_CONFIG.commute && HOMEBOARD_CONFIG.commute.walkSpeed) || 5) * 1000 / 60;
              walkMin = Math.round(distM / walkSpeedMpm);
            }
          }
        } catch (e) { /* skip */ }

    // Fetch transit via HAFAS (with real-time delays)
        let transitMin = null;
        let transitLegs = [];
        let transitDelayMin = 0;
        const hafasKey = HOMEBOARD_CONFIG.departures?.hafasAccessId;
        if (hafasKey) {
          try {
            const hafasUrl = `https://vbb.demo.hafas.cloud/api/fahrinfo/latest/trip?` +
              `accessId=${hafasKey}` +
              `&originCoordLat=${origin.latitude}&originCoordLong=${origin.longitude}` +
              `&destCoordLat=${destLat}&destCoordLong=${destLon}` +
              `&format=json&numF=1&rtMode=FULL`;
            const hafasRes = await fetch(hafasUrl);
            if (hafasRes.ok) {
              const hData = await hafasRes.json();
              const trips = hData.Trip || [];
              if (trips.length > 0) {
                const trip = trips[0];
                const plannedMin = parsePTDuration(trip.duration);
                transitMin = plannedMin;

                // Calculate real-time duration from actual departure/arrival
                const originDep = trip.Origin?.rtTime || trip.Origin?.time;
                const originDate = trip.Origin?.rtDate || trip.Origin?.date;
                const destArr = trip.Destination?.rtTime || trip.Destination?.time;
                const destDate = trip.Destination?.rtDate || trip.Destination?.date;
                if (originDep && destArr && originDate && destDate) {
                  const depDt = parseHafasDateTime(originDate, originDep);
                  const arrDt = parseHafasDateTime(destDate, destArr);
                  if (depDt && arrDt) {
                    const realMin = Math.round((arrDt - depDt) / 60000);
                    if (realMin > 0) {
                      transitDelayMin = realMin - plannedMin;
                      transitMin = realMin;
                    }
                  }
                }

                let legs = trip.LegList?.Leg || [];
                if (!Array.isArray(legs)) legs = [legs];
                transitLegs = legs.map(leg => {
                  const name = (leg.name || '').trim();
                  const dur = parsePTDuration(leg.duration);
                  const from = (leg.Origin?.name || '').replace(' (Berlin)', '').replace(' Bhf', '');
                  const to = (leg.Destination?.name || '').replace(' (Berlin)', '').replace(' Bhf', '');
                  // Check for per-leg delay
                  const legDelay = leg.Destination?.rtTime && leg.Destination?.time
                    ? parseHafasTimeDiff(leg.Destination.date, leg.Destination.time, leg.Destination.rtDate || leg.Destination.date, leg.Destination.rtTime)
                    : 0;
                  if (!name || name === 'Fußweg' || leg.type === 'WALK') {
                    return { type: 'walk', duration: dur };
                  }
                  return { type: 'transit', line: name, from, to, duration: dur, delay: legDelay };
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
                  const from = (leg.from?.name || '').replace(' (Berlin)', '');
                  const to = (leg.to?.name || '').replace(' (Berlin)', '');
                  return { type: 'transit', line, from, to, duration: dur };
                });
              }
            }
          } catch (e) { /* skip */ }
        }

        // Update the rendered event with full commute info
        const eventEl = document.querySelector(`[data-event-idx="${i}"]`);
        if (eventEl && (bikeMin || transitMin || walkMin)) {
          const commuteEl = eventEl.querySelector('.event-commute');
          if (commuteEl) {
            const now = new Date();
            const lang = Lang.get();

            // "Leave" badge next to event name
            // Preference: walk if <15min, bike if <30min, otherwise transit
            const evStart = events[i].start;
            if (evStart && !events[i].allDay) {
              let bestTime;
              let bestMode;
              if (walkMin && walkMin <= 15) { bestTime = walkMin; bestMode = '🚶'; }
              else if (bikeMin && bikeMin <= 30) { bestTime = bikeMin; bestMode = '🚲'; }
              else { bestTime = transitMin || bikeMin || walkMin; bestMode = transitMin ? '🚋' : bikeMin ? '🚲' : '🚶'; }
              const leaveAt = new Date(evStart.getTime() - bestTime * 60000);
              if (leaveAt > now) {
                const leaveInMin = Math.round((leaveAt - now) / 60000);
                let leaveBadge = '';
                if (leaveInMin <= 30) {
                  // Close: show countdown
                  leaveBadge = lang === 'de' ? `${bestMode} los in ${leaveInMin} min` : lang === 'es' ? `${bestMode} salir en ${leaveInMin} min` : `${bestMode} leave in ${leaveInMin} min`;
                } else {
                  // Further out: show time
                  const leaveStr = `${leaveAt.getHours().toString().padStart(2,'0')}:${leaveAt.getMinutes().toString().padStart(2,'0')}`;
                  leaveBadge = lang === 'de' ? `${bestMode} los um ${leaveStr}` : lang === 'es' ? `${bestMode} salir a las ${leaveStr}` : `${bestMode} leave at ${leaveStr}`;
                }
                const untilEl = eventEl.querySelector('.event-until');
                if (untilEl) {
                  untilEl.textContent = leaveBadge;
                } else {
                  const row = eventEl.querySelector('.event-row');
                  if (row) row.insertAdjacentHTML('beforeend', `<span class="event-until">${leaveBadge}</span>`);
                }
              } else {
                // Past: remove leave badge if present
                const untilEl = eventEl.querySelector('.event-until');
                if (untilEl) untilEl.remove();
              }
            }

            // Full route display — preferred mode first
            // Preference: walk if <15min, bike if <30min, otherwise transit
            let routeHtml = '';
            const preferred = (walkMin && walkMin <= 15) ? 'walk' : (bikeMin && bikeMin <= 30) ? 'bike' : 'transit';

            // Walk (only show if ≤30min)
            if (walkMin && walkMin <= 30) {
              const pref = preferred === 'walk' ? ' event-route-preferred' : '';
              routeHtml += `<div class="event-route-line${pref}">🚶 ${walkMin} min · ${walkKm} km</div>`;
            }
            // Bike
            if (bikeMin) {
              const pref = preferred === 'bike' ? ' event-route-preferred' : '';
              routeHtml += `<div class="event-route-line${pref}">🚲 ${bikeMin} min · ${bikeKm} km</div>`;
            }
            // Transit
            if (transitMin && transitLegs.length > 0) {
              const legParts = transitLegs.map(leg => {
                if (leg.type === 'walk') {
                  return `<span class="event-route-walk">🚶${leg.duration} min</span>`;
                }
                const fromLabel = leg.from ? `<span class="station-badge">${leg.from}</span>` : '';
                const toLabel = leg.to ? ` <span class="event-route-to">→ <span class="station-badge">${leg.to}</span></span>` : '';
                const delayBadge = leg.delay > 0 ? `<span class="event-route-delay">+${leg.delay}</span>` : '';
                const style = window.getTransitLineStyle ? window.getTransitLineStyle(leg.line) : { bg: 'var(--surface-hover)', fg: 'var(--text)' };
                return `${fromLabel}<span class="transit-badge" style="background:${style.bg};color:${style.fg};border-color:${style.bg}">${leg.line}${delayBadge}</span>${toLabel}`;
              }).join(' · ');
              const pref = preferred === 'transit' ? ' event-route-preferred' : '';
              const delayNote = transitDelayMin > 0 ? ` <span class="event-route-delay">+${transitDelayMin} min</span>` : '';
              routeHtml += `<div class="event-route-line${pref}">🚋 ${transitMin} min${delayNote} · ${legParts}</div>`;
            } else if (transitMin) {
              const pref = preferred === 'transit' ? ' event-route-preferred' : '';
              const delayNote = transitDelayMin > 0 ? ` <span class="event-route-delay">+${transitDelayMin} min</span>` : '';
              routeHtml += `<div class="event-route-line${pref}">🚋 ${transitMin} min${delayNote}</div>`;
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
          else if (line.startsWith('SUMMARY')) { event.summary = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\'); }
          else if (line.startsWith('LOCATION')) { event.location = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\'); }
          else if (line.startsWith('DESCRIPTION')) { event.description = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\').replace(/\\n/g, '\n'); }
          else if (line.startsWith('ATTENDEE')) { if (!event.attendees) event.attendees = []; const cn = line.match(/CN=([^;:]+)/i); if (cn) event.attendees.push(cn[1].replace(/"/g, '')); }
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
    // Re-render main event list for selected day
    const config = HOMEBOARD_CONFIG.calendar;
    const dayData = _multiDayCache[idx];
    if (dayData) {
      render(dayData.events.slice(0, config.maxEvents));
      // Update card header title
      const headerLabel = document.querySelector('.card-calendar .card-header span[data-i18n="calendar_title"]');
      if (headerLabel) headerLabel.textContent = dayData.label;
      // Fetch commute for events with locations
      if (config.showCommute) {
        fetchCommuteForEvents(dayData.events.slice(0, config.maxEvents));
      }
    }
    // Update strip selection highlight
    renderWeekStrip();
  }

  function renderDayTabs() {
    // No tabs — week strip handles day switching
  }

  function renderWeekStrip() {
    // Week strip is rendered once in a persistent container
    let stripContainer = document.getElementById('calendar-week-strip');
    if (!stripContainer) {
      const previewEl = document.getElementById('calendar-tomorrow');
      if (!previewEl) return;
      previewEl.innerHTML = '<div id="calendar-week-strip"></div>';
      stripContainer = document.getElementById('calendar-week-strip');
    }

    // Mini week overview: single dot if day has events
    stripContainer.innerHTML = `<div class="cal-week-strip">${_multiDayCache.map((day, i) => {
      const isToday = i === 0;
      const isSelected = i === _selectedDay;
      const hasEvents = day.events.length > 0;
      return `<div class="cal-week-day ${isToday ? 'cal-week-today' : ''} ${isSelected ? 'cal-week-selected' : ''}" onclick="Calendar.switchDay(${i})">
        <span class="cal-week-name">${day.dayName}</span>
        <span class="cal-week-date">${day.date.getDate()}</span>
      </div>`;
    }).join('')}</div>`;
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

      // Determine if event has ended
      const eventEnd = ev.end || new Date(ev.start.getTime() + 60 * 60000); // default 1h if no end
      const isPast = eventEnd <= now;

      const timeStr = `${ev.start.getHours().toString().padStart(2,'0')}:${ev.start.getMinutes().toString().padStart(2,'0')}`;
      const timeHtml = `<span class="event-time">${timeStr}</span>`;

      // Duration badge
      let durationHtml = '';
      if (ev.end && !ev.allDay) {
        const durMin = Math.round((ev.end - ev.start) / 60000);
        if (durMin > 0) {
          const durStr = durMin >= 60
            ? `${Math.floor(durMin / 60)}h${durMin % 60 > 0 ? ` ${durMin % 60}m` : ''}`
            : `${durMin} min`;
          durationHtml = `<span class="event-duration">${durStr}</span>`;
        }
      }

      // Time-until badge
      const diffMin = Math.round((ev.start - now) / 60000);
      let untilHtml = '';
      if (!isPast && diffMin > 0 && diffMin <= 90) {
        untilHtml = `<span class="event-until">in ${diffMin} min</span>`;
      } else if (!isPast && diffMin > 0 && diffMin <= 180) {
        const hrs = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        untilHtml = `<span class="event-until">in ${hrs}h${mins > 0 ? ` ${mins}m` : ''}</span>`;
      }

      const locationLabel = ev.location
        ? isHomeAddress(ev.location)
          ? `<div class="event-location event-location-home">🏠 ${i18n('home')}</div>`
          : `<a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOMEBOARD_CONFIG.location.address || '')}&destination=${encodeURIComponent(ev.location)}" target="_blank" class="event-location">📍 ${ev.location.split(',')[0]}</a>`
        : '';
      const locationHtml = ev.location && isBerlinLocation(ev.location)
        ? `<div class="event-commute" title="${ev.location}"></div>`
        : '';

      const summaryHtml = `<span class="event-summary event-clickable" data-detail-idx="${actualIdx}">${ev.summary || 'Untitled'}</span>`;

      return `<li data-event-idx="${actualIdx}"${isPast ? ' class="event-past"' : ''}><div class="event-row">${timeHtml}${durationHtml}${summaryHtml}${untilHtml}</div>${locationLabel}${locationHtml}</li>`;
    }).join('');

    list.innerHTML = allDayHtml + timedHtml;

    // Store events for detail overlay and attach click handlers
    _renderedEvents = events;
    list.querySelectorAll('.event-clickable').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(el.getAttribute('data-detail-idx'));
        showEventDetail(_renderedEvents[idx]);
      });
    });
  }

  let _renderedEvents = [];

  function showEventDetail(ev) {
    if (!ev) return;
    // Remove existing overlay
    const existing = document.getElementById('event-detail-overlay');
    if (existing) existing.remove();

    const timeStr = ev.allDay
      ? (Lang.get() === 'de' ? 'Ganztägig' : Lang.get() === 'es' ? 'Todo el día' : 'All day')
      : `${ev.start.getHours().toString().padStart(2,'0')}:${ev.start.getMinutes().toString().padStart(2,'0')}` +
        (ev.end ? ` – ${ev.end.getHours().toString().padStart(2,'0')}:${ev.end.getMinutes().toString().padStart(2,'0')}` : '');

    let durationStr = '';
    if (ev.end && !ev.allDay) {
      const durMin = Math.round((ev.end - ev.start) / 60000);
      if (durMin > 0) {
        durationStr = durMin >= 60
          ? `${Math.floor(durMin / 60)}h${durMin % 60 > 0 ? ` ${durMin % 60}m` : ''}`
          : `${durMin} min`;
      }
    }

    const locationHtml = ev.location
      ? `<div class="detail-row"><span class="detail-icon">📍</span><a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOMEBOARD_CONFIG.location.address || '')}&destination=${encodeURIComponent(ev.location)}" target="_blank" class="detail-link">${ev.location}</a></div>`
      : '';

    const descHtml = ev.description
      ? `<div class="detail-row detail-desc">${ev.description.replace(/\n/g, '<br>')}</div>`
      : '';

    const attendeesHtml = ev.attendees && ev.attendees.length > 0
      ? `<div class="detail-row"><span class="detail-icon">👥</span>${ev.attendees.join(', ')}</div>`
      : '';

    const overlay = document.createElement('div');
    overlay.id = 'event-detail-overlay';
    overlay.innerHTML = `
      <div class="event-detail-card">
        <div class="detail-header">
          <span class="detail-summary">${ev.summary || 'Untitled'}</span>
          <button class="detail-close" aria-label="Close">✕</button>
        </div>
        <div class="detail-time">${timeStr}${durationStr ? ` · ${durationStr}` : ''}</div>
        ${locationHtml}
        ${attendeesHtml}
        ${descHtml}
      </div>`;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('detail-close')) {
        overlay.remove();
      }
    });

    document.body.appendChild(overlay);
  }

  function parsePTDuration(str) {
    if (!str) return null;
    const h = str.match(/(\d+)H/);
    const m = str.match(/(\d+)M/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }

  function parseHafasDateTime(dateStr, timeStr) {
    // HAFAS format: date=YYYY-MM-DD, time=HH:MM:SS
    if (!dateStr || !timeStr) return null;
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, m] = timeStr.split(':').map(Number);
    return new Date(y, mo - 1, d, h, m);
  }

  function parseHafasTimeDiff(date1, time1, date2, time2) {
    // Returns delay in minutes (positive = late)
    const dt1 = parseHafasDateTime(date1, time1);
    const dt2 = parseHafasDateTime(date2, time2);
    if (!dt1 || !dt2) return 0;
    return Math.round((dt2 - dt1) / 60000);
  }

  return { init, switchDay };
})();
