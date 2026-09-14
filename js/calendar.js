/**
 * Calendar module - Google Calendar ICS parser & daily agenda with location commute
 * - Multi-day overview with day switcher
 * - Commute travel times (Walk, Bike, Transit via HAFAS / Transitous)
 * - Custom place configuration & preferred transit route selection
 * - Smart Category detection, icons, & colored accent stripes
 * - Return Home commute calculation in event detail modal
 * - Weather & Rain-aware smart transport mode selection
 * - Interactive mode switcher for Desktop, Tablet, and Mobile
 */
const Calendar = (() => {
  let refreshInterval;
  let _multiDayCache = []; // cached events per day [{date, label, dayName, events}]
  let _selectedDay = 0;   // 0=today, 1=tomorrow, 2=day after
  let _renderedEvents = [];
  let _eventCommuteData = {};
  let _eventModeOverrides = {};
  let _currentCommuteGen = 0;

  const GOOGLE_COLORS = {
    '1': '#7986cb', 'lavender': '#7986cb',
    '2': '#33b679', 'sage': '#33b679',
    '3': '#8e24aa', 'grape': '#8e24aa',
    '4': '#e67c73', 'flamingo': '#e67c73',
    '5': '#f6bf26', 'banana': '#f6bf26',
    '6': '#f4511e', 'tangerine': '#f4511e',
    '7': '#039be5', 'peacock': '#039be5',
    '8': '#616161', 'graphite': '#616161',
    '9': '#3f51b5', 'blueberry': '#3f51b5',
    '10': '#0b8043', 'basil': '#0b8043',
    '11': '#d50000', 'tomato': '#d50000',
    'red': '#d50000', 'orange': '#f4511e', 'yellow': '#f6bf26',
    'green': '#0b8043', 'blue': '#039be5', 'purple': '#8e24aa', 'cyan': '#00acc1'
  };

  const DEFAULT_CATEGORIES = {
    fitness: {
      label: 'Fitness', icon: '🏋️', color: '#f4511e',
      match: ['ride.bln', 'gym', 'workout', 'training', 'boulder', 'spinning', 'fitness', 'pilates', 'yoga', 'crossfit', 'laufen', 'joggen', 'swim', 'schwimmen', 'sport']
    },
    work: {
      label: 'Work', icon: '💼', color: '#039be5',
      match: ['digitalcampus', 'sync', 'standup', 'meeting', 'sprint', '1:1', 'review', 'retro', 'db systel', 'office', 'call', 'arbeit']
    },
    health: {
      label: 'Health', icon: '🩺', color: '#0b8043',
      match: ['arzt', 'zahnarzt', 'zahn', 'doctor', 'dentist', 'termin', 'physio', 'blutabnahme', 'impfung', 'klinik', 'praxis']
    },
    social: {
      label: 'Social', icon: '🥂', color: '#e67c73',
      match: ['dinner', 'drinks', 'lunch', 'brunch', 'geburtstag', 'birthday', 'party', 'bar', 'restaurant', 'cafe', 'cocktail', 'abendessen', 'mittagessen', 'date', 'treffen', 'freunde']
    },
    travel: {
      label: 'Travel', icon: '✈️', color: '#8e24aa',
      match: ['flug', 'flight', 'zug', 'ice', 'hotel', 'urlaub', 'airbnb', 'airport', 'ber', 'flughafen', 'ferien', 'vacation', 'trip']
    },
    culture: {
      label: 'Culture', icon: '🎭', color: '#6f4e9c',
      match: ['kino', 'cinema', 'theater', 'konzert', 'concert', 'museum', 'ausstellung', 'oper', 'festival']
    },
    chores: {
      label: 'Chores', icon: '🛒', color: '#f6bf26',
      match: ['einkauf', 'supermarkt', 'ikea', 'rewe', 'edeka', 'putzen', 'waschen', 'auto', 'tüv', 'paket']
    }
  };

  function init() {
    const config = HOMEBOARD_CONFIG.calendar;
    if (!config.icsUrl) {
      document.getElementById('event-list').innerHTML =
        '<li class="event-placeholder">Set icsUrl in config</li>';
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
      renderMultiDay(icsText);
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
        } else if (line.startsWith('COLOR:') || line.startsWith('X-COLOR:') || line.startsWith('X-APPLE-CALENDAR-COLOR:')) {
          event.color = line.split(':').pop().trim();
        } else if (line.startsWith('CATEGORIES:')) {
          event.category = line.split(':').slice(1).join(':').trim();
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

  function isVirtualLocation(loc) {
    if (!loc) return false;
    const l = loc.toLowerCase().trim();
    if (l.startsWith('http://') || l.startsWith('https://') || l.includes('zoom.us') || l.includes('meet.google.com') || l.includes('teams.microsoft.com') || l.includes('webex.com')) {
      return true;
    }
    const virtualWords = ['online', 'virtuell', 'remote', 'zoom', 'teams', 'google meet', 'skype', 'discord', 'telefon', 'phone call', 'webinar'];
    return virtualWords.some(w => l === w || l.startsWith(w + ' ') || l.endsWith(' ' + w));
  }

  function isBerlinLocation(loc) {
    if (!loc) return false;
    if (isVirtualLocation(loc)) return false;

    const l = loc.toLowerCase();

    // Check for explicit foreign / other German cities
    const nonBerlinCities = [
      'münchen', 'munich', 'hamburg', 'köln', 'cologne', 'frankfurt', 'stuttgart',
      'düsseldorf', 'dortmund', 'essen', 'leipzig', 'dresden', 'hannover', 'nürnberg',
      'bremen', 'bochum', 'wuppertal', 'bielefeld', 'bonn', 'münster', 'karlsruhe',
      'mannheim', 'augsburg', 'wiesbaden', 'gelsenkirchen', 'aachen', 'braunschweig',
      'kiel', 'chemnitz', 'halle', 'magdeburg', 'freiburg', 'krefeld', 'mainz', 'lübeck',
      'erfurt', 'oberhausen', 'rostock', 'kassel', 'hagen', 'saarbrücken',
      'wien', 'vienna', 'zürich', 'zurich', 'london', 'paris', 'madrid', 'barcelona',
      'amsterdam', 'rom', 'rome', 'milan', 'mailand', 'lisbon', 'lissabon', 'new york'
    ];

    const allowedVbb = ['berlin', 'potsdam', 'schönefeld', 'ber', 'teltow', 'kleinmachnow', 'stahnsdorf', 'falkensee', 'oranienburg', 'bernau', 'strausberg', 'königs wusterhausen', 'erkner'];

    for (const city of nonBerlinCities) {
      const regex = new RegExp(`\\b${city}\\b`, 'i');
      if (regex.test(l)) {
        if (allowedVbb.some(local => l.includes(local))) {
          continue;
        }
        return false;
      }
    }

    // Check 5-digit German postal code
    const zipMatch = loc.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const zip = parseInt(zipMatch[1], 10);
      // Berlin: 10000-14199. VBB Brandenburg: 14400-16999.
      if (zip < 10000 || (zip > 16999 && zip < 99999) || (zip >= 17000 && zip <= 19999)) {
        return false;
      }
    }

    return true;
  }

  function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
    if (!ev.allDay && ev.start) return ev.start <= now;
    return false;
  }

  function getPlaceConfig(ev) {
    const places = HOMEBOARD_CONFIG.calendar?.places || [];
    if (!places.length || (!ev.location && !ev.summary)) return null;

    const locText = (ev.location || '').toLowerCase();
    const sumText = (ev.summary || '').toLowerCase();

    for (const place of places) {
      if (!place) continue;
      const matchCriteria = place.match ?? place.pattern ?? place.name ?? place.label;
      if (!matchCriteria) continue;

      if (Array.isArray(matchCriteria)) {
        const matches = matchCriteria.some(pattern => {
          const p = String(pattern).toLowerCase();
          return locText.includes(p) || sumText.includes(p);
        });
        if (matches) return place;
      } else if (typeof matchCriteria === 'string') {
        const p = matchCriteria.toLowerCase();
        let isRegex = false;
        try {
          if (p.startsWith('/') && p.endsWith('/')) {
            const re = new RegExp(p.slice(1, -1), 'i');
            if (re.test(ev.location || '') || re.test(ev.summary || '')) return place;
            isRegex = true;
          }
        } catch (e) {}
        if (!isRegex && (locText.includes(p) || sumText.includes(p))) {
          return place;
        }
      }
    }
    return null;
  }

  function getEventCategoryAndColor(ev) {
    if (!ev) return { category: null, icon: '', color: 'var(--accent)', dimBg: 'var(--accent-dim)' };

    if (HOMEBOARD_CONFIG.calendar?.showCategories === false) {
      return { category: null, icon: '', color: 'var(--accent)', dimBg: 'var(--accent-dim)' };
    }

    const placeConfig = getPlaceConfig(ev);
    const userCategories = HOMEBOARD_CONFIG.calendar?.categories || {};

    // 1. Direct Place Config
    if (placeConfig?.category || placeConfig?.color || placeConfig?.icon) {
      const catKey = (placeConfig.category || '').toLowerCase();
      const matchedCat = userCategories[catKey] || DEFAULT_CATEGORIES[catKey];
      const colorRaw = placeConfig.color || matchedCat?.color || 'var(--accent)';
      const colorHex = GOOGLE_COLORS[colorRaw.toLowerCase()] || colorRaw;
      return {
        category: placeConfig.category || matchedCat?.label || null,
        icon: placeConfig.icon || matchedCat?.icon || '',
        color: colorHex,
        dimBg: colorHex.startsWith('#') ? `${colorHex}22` : 'var(--accent-dim)'
      };
    }

    const text = `${ev.summary || ''} ${ev.location || ''}`.toLowerCase();

    // 2. User-defined customizable categories (highest priority)
    for (const [key, catObj] of Object.entries(userCategories)) {
      if (!catObj || catObj.enabled === false) continue;
      const patterns = Array.isArray(catObj.match) ? catObj.match : (catObj.match ? [catObj.match] : [key]);
      const match = patterns.some(p => text.includes(String(p).toLowerCase()));
      if (match) {
        const colorRaw = catObj.color || 'var(--accent)';
        const colorHex = GOOGLE_COLORS[colorRaw.toLowerCase()] || colorRaw;
        return {
          category: catObj.label || (key.charAt(0).toUpperCase() + key.slice(1)),
          icon: catObj.icon || '',
          color: colorHex,
          dimBg: colorHex.startsWith('#') ? `${colorHex}22` : 'var(--accent-dim)'
        };
      }
    }

    // 3. Built-in Smart Categories (if not disabled by user)
    for (const [key, def] of Object.entries(DEFAULT_CATEGORIES)) {
      if (userCategories[key] && userCategories[key].enabled === false) continue;
      const match = def.match.some(p => text.includes(p));
      if (match) {
        return {
          category: def.label,
          icon: def.icon,
          color: def.color,
          dimBg: `${def.color}22`
        };
      }
    }

    // 4. Fallback: categoryColors map
    const categoryColors = HOMEBOARD_CONFIG.calendar?.categoryColors || {};
    for (const [key, col] of Object.entries(categoryColors)) {
      if (text.includes(key.toLowerCase())) {
        const colorHex = GOOGLE_COLORS[col.toLowerCase()] || col;
        return {
          category: key.charAt(0).toUpperCase() + key.slice(1),
          icon: '',
          color: colorHex,
          dimBg: colorHex.startsWith('#') ? `${colorHex}22` : 'var(--accent-dim)'
        };
      }
    }

    // 5. Fallback: ICS native color or category
    if (ev.color) {
      const colorHex = GOOGLE_COLORS[ev.color.toLowerCase()] || ev.color;
      return {
        category: ev.category || null,
        icon: '',
        color: colorHex,
        dimBg: colorHex.startsWith('#') ? `${colorHex}22` : 'var(--accent-dim)'
      };
    }

    return { category: null, icon: '', color: 'var(--accent)', dimBg: 'var(--accent-dim)' };
  }

  function isModeAllowed(placeConfig, mode) {
    if (!placeConfig) return true;
    if (Array.isArray(placeConfig.modes)) {
      const normalizedModes = placeConfig.modes.map(m => String(m).toLowerCase());
      if (mode === 'transit') {
        return normalizedModes.includes('transit') || normalizedModes.includes('öpnv') || normalizedModes.includes('oepnv') || normalizedModes.includes('public');
      }
      return normalizedModes.includes(mode);
    }
    if (Array.isArray(placeConfig.excludeModes)) {
      const normalizedEx = placeConfig.excludeModes.map(m => String(m).toLowerCase());
      if (mode === 'transit' && (normalizedEx.includes('transit') || normalizedEx.includes('öpnv') || normalizedEx.includes('oepnv'))) {
        return false;
      }
      if (normalizedEx.includes(mode)) return false;
    }
    if (mode === 'transit' && (placeConfig.transit === false || placeConfig.oepnv === false || placeConfig.öpnv === false)) return false;
    if (mode === 'bike' && placeConfig.bike === false) return false;
    if (mode === 'walk' && placeConfig.walk === false) return false;
    return true;
  }

  function selectBestTransitTrip(trips, placeConfig) {
    if (!trips || trips.length === 0) return null;
    if (!placeConfig) return trips[0];

    let prefLines = [];
    if (Array.isArray(placeConfig.preferredLines)) {
      prefLines = placeConfig.preferredLines.map(l => String(l).toLowerCase().trim());
    } else if (typeof placeConfig.preferredLines === 'string') {
      prefLines = [placeConfig.preferredLines.toLowerCase().trim()];
    } else if (Array.isArray(placeConfig.preferredTransit)) {
      prefLines = placeConfig.preferredTransit.map(l => String(l).toLowerCase().trim());
    } else if (typeof placeConfig.preferredTransit === 'string') {
      prefLines = [placeConfig.preferredTransit.toLowerCase().trim()];
    } else if (placeConfig.preferredTransit && typeof placeConfig.preferredTransit === 'object') {
      if (Array.isArray(placeConfig.preferredTransit.lines)) {
        prefLines = placeConfig.preferredTransit.lines.map(l => String(l).toLowerCase().trim());
      } else if (typeof placeConfig.preferredTransit.lines === 'string') {
        prefLines = [placeConfig.preferredTransit.lines.toLowerCase().trim()];
      }
    }

    const prefVia = (placeConfig.preferredTransitVia || placeConfig.transitVia || placeConfig.via || (placeConfig.preferredTransit && placeConfig.preferredTransit.via) || '').toLowerCase().trim();

    if (prefLines.length === 0 && !prefVia) {
      return trips[0];
    }

    let bestTrip = trips[0];
    let bestScore = -1;

    for (const trip of trips) {
      let score = 0;
      let legs = trip.LegList?.Leg || [];
      if (!Array.isArray(legs)) legs = [legs];

      for (const leg of legs) {
        const legName = (leg.name || '').toLowerCase();
        const fromName = (leg.Origin?.name || '').toLowerCase();
        const toName = (leg.Destination?.name || '').toLowerCase();

        for (const pl of prefLines) {
          if (legName.includes(pl) || legName.replace(/\s+/g, '').includes(pl.replace(/\s+/g, ''))) {
            score += 10;
          }
        }

        if (prefVia && (fromName.includes(prefVia) || toName.includes(prefVia))) {
          score += 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestTrip = trip;
      }
    }

    return bestTrip;
  }

  function selectBestTransitousItinerary(itineraries, placeConfig) {
    if (!itineraries || itineraries.length === 0) return null;
    if (!placeConfig) return itineraries[0];

    let prefLines = [];
    if (Array.isArray(placeConfig.preferredLines)) {
      prefLines = placeConfig.preferredLines.map(l => String(l).toLowerCase().trim());
    } else if (typeof placeConfig.preferredLines === 'string') {
      prefLines = [placeConfig.preferredLines.toLowerCase().trim()];
    } else if (Array.isArray(placeConfig.preferredTransit)) {
      prefLines = placeConfig.preferredTransit.map(l => String(l).toLowerCase().trim());
    } else if (typeof placeConfig.preferredTransit === 'string') {
      prefLines = [placeConfig.preferredTransit.toLowerCase().trim()];
    } else if (placeConfig.preferredTransit && typeof placeConfig.preferredTransit === 'object') {
      if (Array.isArray(placeConfig.preferredTransit.lines)) {
        prefLines = placeConfig.preferredTransit.lines.map(l => String(l).toLowerCase().trim());
      } else if (typeof placeConfig.preferredTransit.lines === 'string') {
        prefLines = [placeConfig.preferredTransit.lines.toLowerCase().trim()];
      }
    }

    const prefVia = (placeConfig.preferredTransitVia || placeConfig.transitVia || placeConfig.via || (placeConfig.preferredTransit && placeConfig.preferredTransit.via) || '').toLowerCase().trim();

    if (prefLines.length === 0 && !prefVia) {
      return itineraries[0];
    }

    let bestIt = itineraries[0];
    let bestScore = -1;

    for (const it of itineraries) {
      let score = 0;
      const legs = it.legs || [];
      for (const leg of legs) {
        const lineName = (leg.route || leg.routeShortName || leg.mode || '').toLowerCase();
        const fromName = (leg.from?.name || '').toLowerCase();
        const toName = (leg.to?.name || '').toLowerCase();

        for (const pl of prefLines) {
          if (lineName.includes(pl) || lineName.replace(/\s+/g, '').includes(pl.replace(/\s+/g, ''))) {
            score += 10;
          }
        }

        if (prefVia && (fromName.includes(prefVia) || toName.includes(prefVia))) {
          score += 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIt = it;
      }
    }

    return bestIt;
  }

  function selectMode(eventIdx, mode, evt) {
    if (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }
    _eventModeOverrides[eventIdx] = mode;
    renderCommuteForEvent(eventIdx);
  }

  function renderCommuteForEvent(idx) {
    const data = _eventCommuteData[idx];
    if (!data) return;

    const eventEl = document.querySelector(`[data-event-idx="${idx}"]`);
    if (!eventEl) return;

    const commuteEl = eventEl.querySelector('.event-commute');
    if (!commuteEl) return;

    const { evStart, isAllDay, placeConfig, bufferMin, isRainExpected, walk, bike, transit } = data;
    const now = new Date();
    const lang = Lang.get();

    // Determine active mode: check user override first, then placeConfig, then rain fallback / default hierarchy
    const userMode = _eventModeOverrides[idx];
    const prefModeConfig = (placeConfig?.preferredMode || '').toLowerCase();
    let preferred = null;

    if (userMode) {
      if (userMode === 'walk' && walk.min) preferred = 'walk';
      else if (userMode === 'bike' && bike.min) preferred = 'bike';
      else if (userMode === 'transit' && transit.min) preferred = 'transit';
    }

    if (!preferred) {
      if (prefModeConfig === 'walk' && walk.min) {
        preferred = 'walk';
      } else if (prefModeConfig === 'bike' && bike.min) {
        if (isRainExpected && (transit.min || walk.min)) {
          const fallback = (placeConfig?.rainFallbackMode || '').toLowerCase();
          if (fallback === 'walk' && walk.min) preferred = 'walk';
          else if (fallback === 'transit' && transit.min) preferred = 'transit';
          else if (transit.min) preferred = 'transit';
          else if (walk.min) preferred = 'walk';
          else preferred = 'bike';
        } else {
          preferred = 'bike';
        }
      } else if ((prefModeConfig === 'transit' || prefModeConfig === 'öpnv' || prefModeConfig === 'oepnv') && transit.min) {
        preferred = 'transit';
      } else {
        if (isRainExpected) {
          if (walk.min && walk.min <= 10) preferred = 'walk';
          else if (transit.min) preferred = 'transit';
          else if (walk.min && walk.min <= 20) preferred = 'walk';
          else if (bike.min) preferred = 'bike';
          else if (walk.min) preferred = 'walk';
        } else {
          if (walk.min && walk.min <= 15) preferred = 'walk';
          else if (bike.min && bike.min <= 30) preferred = 'bike';
          else if (transit.min) preferred = 'transit';
          else if (bike.min) preferred = 'bike';
          else if (walk.min) preferred = 'walk';
        }
      }
    }

    let bestTime = null;
    let bestMode = null;
    if (preferred === 'walk' && walk.min) { bestTime = walk.min; bestMode = '🚶'; }
    else if (preferred === 'bike' && bike.min) { bestTime = bike.min; bestMode = '🚲'; }
    else if (preferred === 'transit' && transit.min) { bestTime = transit.min; bestMode = '🚇'; }
    else if (bike.min) { bestTime = bike.min; bestMode = '🚲'; }
    else if (transit.min) { bestTime = transit.min; bestMode = '🚇'; }
    else if (walk.min) { bestTime = walk.min; bestMode = '🚶'; }

    // Update Leave badge including buffer time
    if (evStart && !isAllDay && bestTime && bestMode) {
      const totalNeedMin = bestTime + (bufferMin || 0);
      const leaveAt = new Date(evStart.getTime() - totalNeedMin * 60000);
      const tooltip = bufferMin > 0
        ? `${bestMode} Travel: ${bestTime}m + ${bufferMin}m buffer`
        : `${bestMode} Travel: ${bestTime}m`;

      if (leaveAt > now) {
        const leaveInMin = Math.round((leaveAt - now) / 60000);
        let leaveBadge = '';
        if (leaveInMin <= 30) {
          leaveBadge = lang === 'de' ? `${bestMode} los in ${leaveInMin} min` : lang === 'es' ? `${bestMode} salir en ${leaveInMin} min` : `${bestMode} leave in ${leaveInMin} min`;
        } else {
          const leaveStr = `${leaveAt.getHours().toString().padStart(2,'0')}:${leaveAt.getMinutes().toString().padStart(2,'0')}`;
          leaveBadge = lang === 'de' ? `${bestMode} los um ${leaveStr}` : lang === 'es' ? `${bestMode} salir a las ${leaveStr}` : `${bestMode} leave at ${leaveStr}`;
        }
        if (isRainExpected) {
          leaveBadge += ' 🌧️';
        }

        const untilEl = eventEl.querySelector('.event-until');
        if (untilEl) {
          untilEl.textContent = leaveBadge;
          untilEl.title = tooltip;
        } else {
          const row = eventEl.querySelector('.event-row');
          if (row) row.insertAdjacentHTML('beforeend', `<span class="event-until" title="${tooltip}">${leaveBadge}</span>`);
        }
      } else {
        const untilEl = eventEl.querySelector('.event-until');
        if (untilEl) untilEl.remove();
      }
    }

    // Full route display with interactive click/tap selection
    let routeHtml = '';
    const rainTag = isRainExpected ? `<span class="event-route-rain" title="Rain forecast at start">🌧️</span>` : '';

    // Walk (only show if <=30min or preferred)
    if (walk.min && (walk.min <= 30 || preferred === 'walk')) {
      const isAct = preferred === 'walk';
      const walkEta = new Date(now.getTime() + walk.min * 60000);
      const walkEtaStr = `${walkEta.getHours().toString().padStart(2,'0')}:${walkEta.getMinutes().toString().padStart(2,'0')}`;
      const check = isAct ? '<span class="event-route-check">✓</span> ' : '';
      routeHtml += `<div class="event-route-line${isAct ? ' event-route-active' : ''}" onclick="Calendar.selectMode(${idx}, 'walk', event)" title="Walk: ${walk.km} km, arrive ~${walkEtaStr} (click to set active mode)">${check}🚶 ${walk.min} min · ${walk.km} km</div>`;
    }

    // Bike
    if (bike.min) {
      const isAct = preferred === 'bike';
      const bikeEta = new Date(now.getTime() + bike.min * 60000);
      const bikeEtaStr = `${bikeEta.getHours().toString().padStart(2,'0')}:${bikeEta.getMinutes().toString().padStart(2,'0')}`;
      const check = isAct ? '<span class="event-route-check">✓</span> ' : '';
      routeHtml += `<div class="event-route-line${isAct ? ' event-route-active' : ''}" onclick="Calendar.selectMode(${idx}, 'bike', event)" title="Bike: ${bike.km} km, arrive ~${bikeEtaStr} (click to set active mode)">${check}🚲 ${bike.min} min · ${bike.km} km${rainTag}</div>`;
    }

    // Transit
    if (transit.min && transit.legs.length > 0) {
      const isAct = preferred === 'transit';
      const check = isAct ? '<span class="event-route-check">✓</span> ' : '';
      const legParts = transit.legs.map(leg => {
        if (leg.type === 'walk') {
          return `<span class="event-route-walk">🚶${leg.duration} min</span>`;
        }
        const fromLabel = leg.from ? `<span class="station-badge">${leg.from}</span>` : '';
        const toLabel = leg.to ? ` <span class="event-route-to">→</span> <span class="station-badge">${leg.to}</span>` : '';
        const delayBadge = '';
        const style = window.getTransitLineStyle ? window.getTransitLineStyle(leg.line) : { bg: 'var(--surface-hover)', fg: 'var(--text)' };
        return `${fromLabel}<span class="transit-badge" style="background:${style.bg};color:${style.fg};border-color:${style.bg}">${leg.line}${delayBadge}</span>${toLabel}`;
      }).join(' · ');
      routeHtml += `<div class="event-route-line${isAct ? ' event-route-active' : ''}" onclick="Calendar.selectMode(${idx}, 'transit', event)" title="Transit: ${transit.min} min (click to set active mode)">${check}🚇 ${transit.min} min · ${legParts}</div>`;
    } else if (transit.min) {
      const isAct = preferred === 'transit';
      const check = isAct ? '<span class="event-route-check">✓</span> ' : '';
      routeHtml += `<div class="event-route-line${isAct ? ' event-route-active' : ''}" onclick="Calendar.selectMode(${idx}, 'transit', event)" title="Transit: ${transit.min} min (click to set active mode)">${check}🚇 ${transit.min} min</div>`;
    }

    commuteEl.innerHTML = routeHtml;
  }

  async function fetchCommuteForEvents(events) {
    const origin = HOMEBOARD_CONFIG.location;
    if (!origin.latitude || !origin.longitude) return;

    const thisGen = ++_currentCommuteGen;

    for (let i = 0; i < events.length; i++) {
      if (thisGen !== _currentCommuteGen) return;

      const ev = events[i];
      if (!ev.location || !isBerlinLocation(ev.location)) continue;
      if (isHomeAddress(ev.location)) continue;
      if (isEventEnded(ev)) continue;

      const placeConfig = getPlaceConfig(ev);
      const allowWalk = isModeAllowed(placeConfig, 'walk');
      const allowBike = isModeAllowed(placeConfig, 'bike');
      const allowTransit = isModeAllowed(placeConfig, 'transit');

      if (!allowWalk && !allowBike && !allowTransit) continue;

      try {
        let destLat = null, destLon = null;
        if (placeConfig && (placeConfig.latitude || placeConfig.lat) && (placeConfig.longitude || placeConfig.lon)) {
          destLat = parseFloat(placeConfig.latitude || placeConfig.lat);
          destLon = parseFloat(placeConfig.longitude || placeConfig.lon);
        }

        const locStr = ev.location;
        const cacheKey = `geo_${locStr}`;

        if (!destLat || !destLon) {
          try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
              const coords = JSON.parse(cached);
              destLat = coords.lat;
              destLon = coords.lon;
            }
          } catch (e) { /* ignore */ }
        }

        if (!destLat || !destLon) {
          const queries = [locStr];
          const parts = locStr.split(',').map(s => s.trim());
          if (parts.length >= 2) {
            queries.push(parts.slice(1).join(', '));
          }
          if (parts.length >= 3) {
            queries.push(parts.slice(-2).join(', '));
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

          // Fallback: Photon geocoder
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

          if (destLat && destLon) {
            try { sessionStorage.setItem(cacheKey, JSON.stringify({ lat: destLat, lon: destLon })); } catch (e) { /* full */ }
          }
        }

        if (!destLat || !destLon || thisGen !== _currentCommuteGen) continue;

        // Skip events located outside Berlin/VBB metro commute zone (> 60km away)
        const distFromHome = getDistanceKm(origin.latitude, origin.longitude, destLat, destLon);
        if (distFromHome > 60 && !placeConfig) {
          continue;
        }

        // Bike time via OSRM
        let bikeMin = null;
        let bikeKm = null;
        if (allowBike) {
          try {
            const bikeUrl = `https://router.project-osrm.org/route/v1/cycling/${origin.longitude},${origin.latitude};${destLon},${destLat}?overview=false`;
            const bikeRes = await fetch(bikeUrl);
            if (bikeRes.ok) {
              const bikeData = await bikeRes.json();
              if (bikeData.code === 'Ok' && bikeData.routes.length) {
                const distM = bikeData.routes[0].distance;
                bikeKm = (distM / 1000).toFixed(1);
                const bikeSpeedMpm = ((HOMEBOARD_CONFIG.commute && HOMEBOARD_CONFIG.commute.bikeSpeed) || 13) * 1000 / 60;
                bikeMin = Math.round(distM / bikeSpeedMpm);
              }
            }
          } catch (e) { /* skip */ }
        }

        // Walk time via OSRM
        let walkMin = null;
        let walkKm = null;
        if (allowWalk) {
          try {
            const walkUrl = `https://router.project-osrm.org/route/v1/foot/${origin.longitude},${origin.latitude};${destLon},${destLat}?overview=false`;
            const walkRes = await fetch(walkUrl);
            if (walkRes.ok) {
              const walkData = await walkRes.json();
              if (walkData.code === 'Ok' && walkData.routes.length) {
                const distM = walkData.routes[0].distance;
                walkKm = (distM / 1000).toFixed(1);
                const walkSpeedMpm = ((HOMEBOARD_CONFIG.commute && HOMEBOARD_CONFIG.commute.walkSpeed) || 5) * 1000 / 60;
                walkMin = Math.round(distM / walkSpeedMpm);
              }
            }
          } catch (e) { /* skip */ }
        }

        // Transit via HAFAS
        let transitMin = null;
        let transitLegs = [];
        let transitDelayMin = 0;
        if (allowTransit) {
          const hafasKey = HOMEBOARD_CONFIG.departures?.hafasAccessId;
          if (hafasKey) {
            try {
              const hafasUrl = `https://vbb.demo.hafas.cloud/api/fahrinfo/latest/trip?` +
                `accessId=${hafasKey}` +
                `&originCoordLat=${origin.latitude}&originCoordLong=${origin.longitude}` +
                `&destCoordLat=${destLat}&destCoordLong=${destLon}` +
                `&format=json&numF=4&rtMode=FULL`;
              const hafasRes = await fetch(hafasUrl);
              if (hafasRes.ok) {
                const hData = await hafasRes.json();
                const trips = hData.Trip || [];
                if (trips.length > 0) {
                  const trip = selectBestTransitTrip(trips, placeConfig);
                  const plannedMin = parsePTDuration(trip.duration);
                  transitMin = plannedMin;

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
                `&mode=TRANSIT,WALK&numItineraries=4`;
              const transitRes = await fetch(transitUrl);
              if (transitRes.ok) {
                const tData = await transitRes.json();
                if (tData.itineraries?.length > 0) {
                  const it = selectBestTransitousItinerary(tData.itineraries, placeConfig);
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
        }

        if (thisGen !== _currentCommuteGen) return;

        // Check rain forecast for event time
        const evStart = events[i].start;
        let isRainExpected = false;
        if (window.Rain?.getRainAt && evStart) {
          const rainInfo = window.Rain.getRainAt(evStart);
          const rainThreshold = placeConfig?.rainThreshold || 50;
          if (rainInfo && (rainInfo.probability >= rainThreshold || rainInfo.precipitation >= 0.5)) {
            isRainExpected = true;
          }
        }

        const defaultBuffer = HOMEBOARD_CONFIG.calendar?.bufferMinutes !== undefined ? HOMEBOARD_CONFIG.calendar.bufferMinutes : 5;
        const bufferMin = placeConfig?.bufferMinutes !== undefined ? placeConfig.bufferMinutes : defaultBuffer;

        // Store data for interactive switching
        _eventCommuteData[i] = {
          evStart,
          isAllDay: events[i].allDay,
          placeConfig,
          bufferMin,
          isRainExpected,
          walk: { min: walkMin, km: walkKm },
          bike: { min: bikeMin, km: bikeKm },
          transit: { min: transitMin, legs: transitLegs }
        };

        renderCommuteForEvent(i);

      } catch (err) {
        // Silently skip failed commute
      }
    }
  }

  function renderMultiDay(icsText) {
    const config = HOMEBOARD_CONFIG.calendar;
    const lines = icsText.replace(/\r\n /g, '').split(/\r?\n/);
    const today = new Date();
    const dowMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
    const lang = Lang.get();
    const dayNamesShort = lang === 'de'
      ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      : lang === 'es'
      ? ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    _multiDayCache = [];
    const patterns = (config.hidePatterns || []).map(p => new RegExp(p, 'i'));

    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const dateStr = dateToStr(date);
      const dow = date.getDay();
      const dayEvents = [];

      let event = null;
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
          else if (line.startsWith('COLOR:') || line.startsWith('X-COLOR:') || line.startsWith('X-APPLE-CALENDAR-COLOR:')) { event.color = line.split(':').pop().trim(); }
          else if (line.startsWith('CATEGORIES:')) { event.category = line.split(':').slice(1).join(':').trim(); }
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

    renderWeekStrip();
    const currentDayEvents = _multiDayCache[_selectedDay] ? _multiDayCache[_selectedDay].events : [];
    render(currentDayEvents);

    if (config.showCommute) {
      fetchCommuteForEvents(currentDayEvents.slice(0, config.maxEvents));
    }
  }

  function switchDay(dayIdx) {
    if (dayIdx < 0 || dayIdx >= _multiDayCache.length) return;
    _selectedDay = dayIdx;
    _eventModeOverrides = {}; // reset mode overrides for new day
    const dayData = _multiDayCache[dayIdx];
    if (dayData) {
      const config = HOMEBOARD_CONFIG.calendar;
      render(dayData.events);
      const headerLabel = document.getElementById('calendar-header-day');
      if (headerLabel) headerLabel.textContent = dayData.label;
      if (config.showCommute) {
        fetchCommuteForEvents(dayData.events.slice(0, config.maxEvents));
      }
    }
    renderWeekStrip();
  }

  function renderWeekStrip() {
    let stripContainer = document.getElementById('calendar-week-strip');
    if (!stripContainer) {
      const previewEl = document.getElementById('calendar-preview');
      if (!previewEl) return;
      previewEl.innerHTML = '<div id="calendar-week-strip"></div>';
      stripContainer = document.getElementById('calendar-week-strip');
    }

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

    // All-day events as pills at the top with subtle category color
    const allDayHtml = allDay.length > 0
      ? `<li class="event-allday-row">${allDay.map(ev => {
          const { category, icon, color, dimBg } = getEventCategoryAndColor(ev);
          const iconPrefix = icon ? `${icon} ` : '';
          const mapsUrl = ev.location ? `https://maps.google.com/?q=${encodeURIComponent(ev.location)}` : '';
          const style = `border-left: 3px solid ${color}; background: ${dimBg}; color: var(--text-1);`;
          return mapsUrl
            ? `<a href="${mapsUrl}" target="_blank" class="event-allday-pill" style="${style}" title="${ev.location}">${iconPrefix}${ev.summary || 'Untitled'}</a>`
            : `<span class="event-allday-pill" style="${style}">${iconPrefix}${ev.summary || 'Untitled'}</span>`;
        }).join('')}</li>`
      : '';

    // Timed events with accent stripes & smart category tags
    const timedHtml = timed.map((ev, i) => {
      const actualIdx = events.indexOf(ev);
      const eventEnd = ev.end || new Date(ev.start.getTime() + 60 * 60000);
      const isPast = eventEnd <= now;

      const { category, icon, color, dimBg } = getEventCategoryAndColor(ev);

      const timeStr = `${ev.start.getHours().toString().padStart(2,'0')}:${ev.start.getMinutes().toString().padStart(2,'0')}`;
      const timeHtml = `<span class="event-time">${timeStr}</span>`;

      // Category badge
      const catBadgeHtml = category
        ? `<span class="event-cat-tag" style="background:${dimBg};color:${color};border-color:${color}44" title="${category}">${icon ? icon + ' ' : ''}${category}</span>`
        : (icon ? `<span class="event-cat-icon">${icon}</span>` : '');

      // Duration badge
      let durationHtml = '';
      let endTimeStr = '';
      if (ev.end && !ev.allDay) {
        const durMin = Math.round((ev.end - ev.start) / 60000);
        endTimeStr = `${ev.end.getHours().toString().padStart(2,'0')}:${ev.end.getMinutes().toString().padStart(2,'0')}`;
        if (durMin > 0) {
          const durStr = durMin >= 60
            ? `${Math.floor(durMin / 60)}h${durMin % 60 > 0 ? ` ${durMin % 60}m` : ''}`
            : `${durMin} min`;
          durationHtml = `<span class="event-duration" title="${timeStr} - ${endTimeStr}">${durStr}</span>`;
        }
      }

      // Time-until badge
      const diffMin = Math.round((ev.start - now) / 60000);
      let untilHtml = '';
      if (!isPast && diffMin > 0 && diffMin <= 90) {
        untilHtml = `<span class="event-until" title="Starts at ${timeStr}">in ${diffMin} min</span>`;
      } else if (!isPast && diffMin > 0 && diffMin <= 180) {
        const hrs = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        untilHtml = `<span class="event-until" title="Starts at ${timeStr}">in ${hrs}h${mins > 0 ? ` ${mins}m` : ''}</span>`;
      }

      const locationLabel = ev.location
        ? isHomeAddress(ev.location)
          ? `<div class="event-location event-location-home" title="${ev.location}">🏠 ${i18n('home')}</div>`
          : `<a href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOMEBOARD_CONFIG.location.address || '')}&destination=${encodeURIComponent(ev.location)}" target="_blank" class="event-location" title="${ev.location}">📍 ${ev.location.split(',')[0]}</a>`
        : '';

      const locationHtml = ev.location && isBerlinLocation(ev.location)
        ? `<div class="event-commute" title="${ev.location}"></div>`
        : '';

      const summaryHtml = `<span class="event-summary event-clickable" data-detail-idx="${actualIdx}">${ev.summary || 'Untitled'}${durationHtml}</span>`;

      return `<li data-event-idx="${actualIdx}" class="event-item${isPast ? ' event-past' : ''}" style="--event-accent: ${color};"><div class="event-row">${timeHtml}${catBadgeHtml}${summaryHtml}${untilHtml}</div>${locationLabel}${locationHtml}</li>`;
    }).join('');

    list.innerHTML = allDayHtml + timedHtml;

    _renderedEvents = events;
    list.querySelectorAll('.event-clickable').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(el.getAttribute('data-detail-idx'));
        showEventDetail(_renderedEvents[idx]);
      });
    });
  }

  function showEventDetail(ev) {
    if (!ev) return;
    const existing = document.getElementById('event-detail-overlay');
    if (existing) existing.remove();

    const actualIdx = _renderedEvents.indexOf(ev);
    const commuteData = actualIdx !== -1 ? _eventCommuteData[actualIdx] : null;
    const activeMode = actualIdx !== -1 ? (_eventModeOverrides[actualIdx] || (commuteData ? (commuteData.bike.min ? 'bike' : commuteData.transit.min ? 'transit' : 'walk') : 'bicycling')) : 'bicycling';

    const gMode = activeMode === 'bike' ? 'bicycling' : activeMode === 'walk' ? 'walking' : 'transit';

    const homeAddr = HOMEBOARD_CONFIG.location.address || `${HOMEBOARD_CONFIG.location.latitude},${HOMEBOARD_CONFIG.location.longitude}`;
    const gmapsOutboundUrl = ev.location
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(homeAddr)}&destination=${encodeURIComponent(ev.location)}&travelmode=${gMode}`
      : '';
    const gmapsReturnUrl = ev.location
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ev.location)}&destination=${encodeURIComponent(homeAddr)}&travelmode=${gMode}`
      : '';

    const timeStr = ev.allDay
      ? (Lang.get() === 'de' ? 'Ganztägig' : Lang.get() === 'es' ? 'Todo el día' : 'All day')
      : `${ev.start.getHours().toString().padStart(2,'0')}:${ev.start.getMinutes().toString().padStart(2,'0')}` +
        (ev.end ? ` - ${ev.end.getHours().toString().padStart(2,'0')}:${ev.end.getMinutes().toString().padStart(2,'0')}` : '');

    let durationStr = '';
    if (ev.end && !ev.allDay) {
      const durMin = Math.round((ev.end - ev.start) / 60000);
      if (durMin > 0) {
        durationStr = durMin >= 60
          ? `${Math.floor(durMin / 60)}h${durMin % 60 > 0 ? ` ${durMin % 60}m` : ''}`
          : `${durMin} min`;
      }
    }

    const { category, icon, color, dimBg } = getEventCategoryAndColor(ev);
    const colorStrip = `<div class="detail-color-strip" style="background:${color}"></div>`;
    const catBadge = category ? `<span class="event-cat-tag detail-cat-badge" style="background:${dimBg};color:${color};border-color:${color}44">${icon ? icon + ' ' : ''}${category}</span>` : '';

    const locationHtml = ev.location
      ? `<div class="detail-row"><span class="detail-icon">📍</span><a href="${gmapsOutboundUrl}" target="_blank" class="detail-link" title="Open in Google Maps">${ev.location}</a></div>`
      : '';

    const descHtml = ev.description
      ? `<div class="detail-row detail-desc">${ev.description.replace(/\n/g, '<br>')}</div>`
      : '';

    const attendeesHtml = ev.attendees && ev.attendees.length > 0
      ? `<div class="detail-row"><span class="detail-icon">👥</span>${ev.attendees.join(', ')}</div>`
      : '';

    // Interactive Mode Selector inside Modal
    let modeTabsHtml = '';
    if (commuteData && (commuteData.walk.min || commuteData.bike.min || commuteData.transit.min)) {
      modeTabsHtml = `<div class="detail-mode-tabs">
        ${commuteData.walk.min ? `<button class="detail-mode-tab ${activeMode === 'walk' ? 'active' : ''}" onclick="Calendar.selectModeAndRefreshDetail(${actualIdx}, 'walk')">🚶 ${commuteData.walk.min}m</button>` : ''}
        ${commuteData.bike.min ? `<button class="detail-mode-tab ${activeMode === 'bike' ? 'active' : ''}" onclick="Calendar.selectModeAndRefreshDetail(${actualIdx}, 'bike')">🚲 ${commuteData.bike.min}m</button>` : ''}
        ${commuteData.transit.min ? `<button class="detail-mode-tab ${activeMode === 'transit' ? 'active' : ''}" onclick="Calendar.selectModeAndRefreshDetail(${actualIdx}, 'transit')">🚇 ${commuteData.transit.min}m</button>` : ''}
      </div>`;
    }

    const showReturn = ev.location && isBerlinLocation(ev.location) && !isHomeAddress(ev.location);
    const returnSectionHtml = showReturn
      ? `<div class="detail-return-box">
          <div class="detail-return-title">🏠 ${Lang.get() === 'de' ? 'Rückweg nach Hause' : Lang.get() === 'es' ? 'Regreso a casa' : 'Return Home'}</div>
          <div class="detail-return-content" id="detail-return-content"><span class="detail-loading">Calculating route...</span></div>
        </div>`
      : '';

    const actionsHtml = ev.location
      ? `<div class="detail-actions">
          <a href="${gmapsOutboundUrl}" target="_blank" class="detail-btn detail-btn-primary">
            🗺️ ${Lang.get() === 'de' ? 'Google Maps Route' : 'Google Maps'}
          </a>
          ${showReturn ? `<a href="${gmapsReturnUrl}" target="_blank" class="detail-btn detail-btn-secondary">
            🏠 ${Lang.get() === 'de' ? 'Route nach Hause' : 'Route Home'}
          </a>` : ''}
        </div>`
      : '';

    const overlay = document.createElement('div');
    overlay.id = 'event-detail-overlay';
    overlay.innerHTML = `
      <div class="event-detail-card">
        ${colorStrip}
        <div class="detail-header">
          <span class="detail-summary">${catBadge}${ev.summary || 'Untitled'}</span>
          <button class="detail-close" aria-label="Close">✕</button>
        </div>
        <div class="detail-time">${timeStr}${durationStr ? ` · ${durationStr}` : ''}</div>
        ${locationHtml}
        ${modeTabsHtml}
        ${returnSectionHtml}
        ${attendeesHtml}
        ${descHtml}
        ${actionsHtml}
      </div>`;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('detail-close')) {
        overlay.remove();
      }
    });

    document.body.appendChild(overlay);

    if (showReturn) {
      setTimeout(() => fetchReturnCommute(ev), 10);
    }
  }

  function selectModeAndRefreshDetail(idx, mode) {
    _eventModeOverrides[idx] = mode;
    renderCommuteForEvent(idx);
    if (_renderedEvents[idx]) {
      showEventDetail(_renderedEvents[idx]);
    }
  }

  async function fetchReturnCommute(ev) {
    const returnContainer = document.getElementById('detail-return-content');
    if (!returnContainer) return;

    const home = HOMEBOARD_CONFIG.location;
    if (!home.latitude || !home.longitude) {
      returnContainer.innerHTML = 'Home coordinates not set';
      return;
    }

    const placeConfig = getPlaceConfig(ev);
    const allowWalk = isModeAllowed(placeConfig, 'walk');
    const allowBike = isModeAllowed(placeConfig, 'bike');
    const allowTransit = isModeAllowed(placeConfig, 'transit');

    try {
      let destLat = null, destLon = null;
      if (placeConfig && (placeConfig.latitude || placeConfig.lat) && (placeConfig.longitude || placeConfig.lon)) {
        destLat = parseFloat(placeConfig.latitude || placeConfig.lat);
        destLon = parseFloat(placeConfig.longitude || placeConfig.lon);
      } else {
        const cached = sessionStorage.getItem(`geo_${ev.location}`);
        if (cached) {
          const coords = JSON.parse(cached);
          destLat = coords.lat;
          destLon = coords.lon;
        }
      }

      if (!destLat || !destLon) {
        returnContainer.innerHTML = 'Could not resolve location coordinates';
        return;
      }

      // Strictly only calculate return commute for Berlin / VBB metro zone (<= 60 km)
      const distFromHome = getDistanceKm(home.latitude, home.longitude, destLat, destLon);
      if (distFromHome > 60) {
        const returnBox = document.querySelector('.detail-return-box');
        if (returnBox) returnBox.remove();
        return;
      }

      const returnTime = ev.end || (ev.start ? new Date(ev.start.getTime() + 60 * 60000) : new Date());
      const now = new Date();
      const startTime = returnTime > now ? returnTime : now;

      // 1. Bike return via OSRM
      let bikeMin = null, bikeKm = null;
      if (allowBike) {
        try {
          const bikeUrl = `https://router.project-osrm.org/route/v1/cycling/${destLon},${destLat};${home.longitude},${home.latitude}?overview=false`;
          const res = await fetch(bikeUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes.length) {
              const distM = data.routes[0].distance;
              bikeKm = (distM / 1000).toFixed(1);
              const speed = ((HOMEBOARD_CONFIG.commute && HOMEBOARD_CONFIG.commute.bikeSpeed) || 13) * 1000 / 60;
              bikeMin = Math.round(distM / speed);
            }
          }
        } catch (e) {}
      }

      // 2. Walk return
      let walkMin = null, walkKm = null;
      if (allowWalk) {
        try {
          const walkUrl = `https://router.project-osrm.org/route/v1/foot/${destLon},${destLat};${home.longitude},${home.latitude}?overview=false`;
          const res = await fetch(walkUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes.length) {
              const distM = data.routes[0].distance;
              walkKm = (distM / 1000).toFixed(1);
              const speed = ((HOMEBOARD_CONFIG.commute && HOMEBOARD_CONFIG.commute.walkSpeed) || 5) * 1000 / 60;
              walkMin = Math.round(distM / speed);
            }
          }
        } catch (e) {}
      }

      // 3. Transit return via HAFAS
      let transitMin = null, transitLegs = [];
      if (allowTransit) {
        const hafasKey = HOMEBOARD_CONFIG.departures?.hafasAccessId;
        if (hafasKey) {
          try {
            const hafasUrl = `https://vbb.demo.hafas.cloud/api/fahrinfo/latest/trip?` +
              `accessId=${hafasKey}` +
              `&originCoordLat=${destLat}&originCoordLong=${destLon}` +
              `&destCoordLat=${home.latitude}&destCoordLong=${home.longitude}` +
              `&format=json&numF=3&rtMode=FULL`;
            const hRes = await fetch(hafasUrl);
            if (hRes.ok) {
              const hData = await hRes.json();
              const trips = hData.Trip || [];
              if (trips.length > 0) {
                const trip = trips[0];
                transitMin = parsePTDuration(trip.duration);
                let legs = trip.LegList?.Leg || [];
                if (!Array.isArray(legs)) legs = [legs];
                transitLegs = legs.map(leg => {
                  const name = (leg.name || '').trim();
                  const dur = parsePTDuration(leg.duration);
                  const from = (leg.Origin?.name || '').replace(' (Berlin)', '').replace(' Bhf', '');
                  const to = (leg.Destination?.name || '').replace(' (Berlin)', '').replace(' Bhf', '');
                  if (!name || name === 'Fußweg' || leg.type === 'WALK') {
                    return { type: 'walk', duration: dur };
                  }
                  return { type: 'transit', line: name, from, to, duration: dur };
                });
              }
            }
          } catch (e) {}
        }
      }

      let html = '';
      if (walkMin && walkMin <= 35) {
        const eta = new Date(startTime.getTime() + walkMin * 60000);
        const etaStr = `${eta.getHours().toString().padStart(2,'0')}:${eta.getMinutes().toString().padStart(2,'0')}`;
        html += `<div class="detail-return-line">🚶 <strong>${walkMin} min</strong> · ${walkKm} km <span class="detail-return-eta">(~${etaStr})</span></div>`;
      }
      if (bikeMin) {
        const eta = new Date(startTime.getTime() + bikeMin * 60000);
        const etaStr = `${eta.getHours().toString().padStart(2,'0')}:${eta.getMinutes().toString().padStart(2,'0')}`;
        html += `<div class="detail-return-line">🚲 <strong>${bikeMin} min</strong> · ${bikeKm} km <span class="detail-return-eta">(~${etaStr})</span></div>`;
      }
      if (transitMin && transitLegs.length > 0) {
        const eta = new Date(startTime.getTime() + transitMin * 60000);
        const etaStr = `${eta.getHours().toString().padStart(2,'0')}:${eta.getMinutes().toString().padStart(2,'0')}`;
        const legsHtml = transitLegs.map(leg => {
          if (leg.type === 'walk') return `<span class="event-route-walk">🚶${leg.duration}m</span>`;
          const style = window.getTransitLineStyle ? window.getTransitLineStyle(leg.line) : { bg: 'var(--surface-hover)', fg: 'var(--text)' };
          return `<span class="transit-badge" style="background:${style.bg};color:${style.fg};border-color:${style.bg}">${leg.line}</span>`;
        }).join(' → ');
        html += `<div class="detail-return-line">🚇 <strong>${transitMin} min</strong> · ${legsHtml} <span class="detail-return-eta">(~${etaStr})</span></div>`;
      }

      returnContainer.innerHTML = html || 'No return routes available';
    } catch (err) {
      returnContainer.innerHTML = 'Failed to load return commute';
    }
  }

  function parsePTDuration(str) {
    if (!str) return null;
    const h = str.match(/(\d+)H/);
    const m = str.match(/(\d+)M/);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  }

  function parseHafasDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, m] = timeStr.split(':').map(Number);
    return new Date(y, mo - 1, d, h, m);
  }

  function parseHafasTimeDiff(date1, time1, date2, time2) {
    const dt1 = parseHafasDateTime(date1, time1);
    const dt2 = parseHafasDateTime(date2, time2);
    if (!dt1 || !dt2) return 0;
    return Math.round((dt2 - dt1) / 60000);
  }

  return { init, switchDay, selectMode, selectModeAndRefreshDetail };
})();
