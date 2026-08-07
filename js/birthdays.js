/**
 * Birthdays module - shows today's birthdays from a dedicated ICS calendar
 * Handles recurring yearly events (RRULE:FREQ=YEARLY)
 */
const Birthdays = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.birthdays;
    if (!config || !config.icsUrl) return;
    fetchBirthdays();
    refreshInterval = setInterval(fetchBirthdays, (config.refreshMinutes || 60) * 60 * 1000);
  }

  async function fetchBirthdays() {
    const config = HOMEBOARD_CONFIG.birthdays;

    try {
      const url = `/proxy?url=${encodeURIComponent(config.icsUrl)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const icsText = await res.text();
      const birthdays = parseBirthdays(icsText);
      render(birthdays);
    } catch (err) {
      console.error('Birthdays fetch failed:', err);
      document.getElementById('birthdays-list').innerHTML =
        `<span class="birthday-error">${i18n('birthdays_error') || 'Error loading birthdays'}</span>`;
    }
  }

  function parseBirthdays(text) {
    const lines = text.replace(/\r\n /g, '').split(/\r?\n/);
    const now = new Date();
    const LOOKAHEAD_DAYS = 7;
    const birthdays = [];
    let event = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        event = { recurring: false };
      } else if (line === 'END:VEVENT' && event) {
        if (event.summary && event.start) {
          const daysUntil = getDaysUntilBirthday(event.start, now);
          if (daysUntil >= 0 && daysUntil <= LOOKAHEAD_DAYS) {
            event.daysUntil = daysUntil;
            birthdays.push(event);
          }
        }
        event = null;
      } else if (event) {
        if (line.startsWith('DTSTART')) {
          event.start = parseICSDate(line.split(':').pop());
        } else if (line.startsWith('SUMMARY')) {
          event.summary = line.split(':').slice(1).join(':');
        } else if (line.startsWith('DESCRIPTION')) {
          event.description = line.split(':').slice(1).join(':');
        } else if (line.includes('RRULE') && line.includes('YEARLY')) {
          event.recurring = true;
        }
      }
    }

    return birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  function getDaysUntilBirthday(startDate, now) {
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let thisYear = new Date(now.getFullYear(), startDate.getMonth(), startDate.getDate());
    // If the birthday already passed this year, check next year
    if (thisYear < todayMidnight) {
      thisYear = new Date(now.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
    }
    const diff = Math.round((thisYear - todayMidnight) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function parseICSDate(str) {
    if (!str) return null;
    const clean = str.replace(/[^0-9T]/g, '');
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));
    return new Date(year, month, day);
  }

  function extractSocialLinks(desc) {
    if (!desc) return '';
    // Unescape ICS line breaks
    const text = desc.replace(/\\n/g, '\n').replace(/\\,/g, ',');
    const links = [];

    // WhatsApp
    const waMatch = text.match(/https?:\/\/wa\.me\/[0-9]+/);
    if (waMatch) links.push(`<a href="${waMatch[0]}" target="_blank" class="birthday-social" title="WhatsApp" onclick="event.stopPropagation()">💬</a>`);

    // Instagram
    const igMatch = text.match(/https?:\/\/(www\.)?instagram\.com\/[^\s\\]+/);
    if (igMatch) links.push(`<a href="${igMatch[0]}" target="_blank" class="birthday-social" title="Instagram" onclick="event.stopPropagation()">📷</a>`);

    // Telegram
    const tgMatch = text.match(/https?:\/\/(t\.me|telegram\.me)\/[^\s\\]+/);
    if (tgMatch) links.push(`<a href="${tgMatch[0]}" target="_blank" class="birthday-social" title="Telegram" onclick="event.stopPropagation()">✈️</a>`);

    // Signal
    const sigMatch = text.match(/https?:\/\/signal\.(me|org)\/[^\s\\]+/);
    if (sigMatch) links.push(`<a href="${sigMatch[0]}" target="_blank" class="birthday-social" title="Signal" onclick="event.stopPropagation()">🔵</a>`);

    // LinkedIn
    const liMatch = text.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s\\]+/);
    if (liMatch) links.push(`<a href="${liMatch[0]}" target="_blank" class="birthday-social" title="LinkedIn" onclick="event.stopPropagation()">💼</a>`);

    return links.join('');
  }

  function render(birthdays) {
    const container = document.getElementById('birthdays-list');

    if (birthdays.length === 0) {
      container.innerHTML = `<span class="birthday-none">${i18n('birthdays_none') || 'Keine Geburtstage'}</span>`;
      return;
    }

    // Deduplicate by name
    const seen = new Set();
    const unique = birthdays.filter(b => {
      const key = (b.summary || '').toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    container.innerHTML = unique.map(b => {
      let name = b.summary || '';
      name = name
        .replace(/'s Birthday$/i, '')
        .replace(/^Birthday of /i, '')
        .replace(/^Geburtstag von /i, '')
        .replace(/ hat Geburtstag$/i, '')
        .replace(/'s Geburtstag$/i, '')
        .trim();

      let when = '';
      if (b.daysUntil === 0) when = 'heute';
      else if (b.daysUntil === 1) when = 'morgen';
      else when = `in ${b.daysUntil} T.`;

      // Don't add icon if name already starts with an emoji
      const startsWithEmoji = /^[\p{Emoji}]/u.test(name);

      // Build Google Calendar link for the birthday date
      const now = new Date();
      let bdayDate = new Date(now.getFullYear(), b.start.getMonth(), b.start.getDate());
      if (bdayDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        bdayDate = new Date(now.getFullYear() + 1, b.start.getMonth(), b.start.getDate());
      }
      const dateStr = `${bdayDate.getFullYear()}${String(bdayDate.getMonth()+1).padStart(2,'0')}${String(bdayDate.getDate()).padStart(2,'0')}`;
      const calUrl = `https://calendar.google.com/calendar/r/day/${bdayDate.getFullYear()}/${bdayDate.getMonth()+1}/${bdayDate.getDate()}`;

      // Extract social links from description
      const links = extractSocialLinks(b.description || '');

      return `<a href="${calUrl}" target="_blank" class="birthday-item">
        ${startsWithEmoji ? '' : '<span class="birthday-icon">🎂</span>'}
        <span class="birthday-name">${name}</span>
        <span class="birthday-links">${links}</span>
        <span class="birthday-when">${when}</span>
      </a>`;
    }).join('');
  }

  return { init };
})();
