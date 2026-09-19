/**
 * Birthdays module - shows upcoming birthdays from ICS feed
 * - Simplified modal with exact contact details & quick action buttons
 * - Direct WhatsApp, Instagram, Google Contacts, and Call integration
 * - Contact labels (from Google Contacts / config)
 * - City / Location badge with local weather preview
 * - Western Zodiac Sternzeichen
 */
const Birthdays = (() => {
  let refreshInterval;
  let _birthdaysList = [];
  let _currentModalIdx = -1;
  let _modalKeyHandler = null;

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
      const el = document.getElementById('birthdays-list');
      if (el) {
        el.innerHTML = `<span class="birthday-error">${(window.i18n && typeof window.i18n === 'function') ? window.i18n('birthdays_error') : 'Fehler beim Laden'}</span>`;
      }
    }
  }

  function parseBirthdays(text) {
    const lines = text.replace(/\r\n /g, '').split(/\r?\n/);
    const now = new Date();
    const LOOKAHEAD_DAYS = (HOMEBOARD_CONFIG.birthdays && HOMEBOARD_CONFIG.birthdays.lookaheadDays) || 7;
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
          event.summary = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        } else if (line.startsWith('LOCATION')) {
          event.location = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
        } else if (line.startsWith('DESCRIPTION')) {
          event.description = line.split(':').slice(1).join(':').replace(/\\,/g, ',').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
        } else if (line.startsWith('CATEGORIES:')) {
          event.categories = line.split(':').slice(1).join(':').trim();
        } else if (line.startsWith('RRULE:')) {
          event.recurring = true;
        }
      }
    }

    birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
    return birthdays;
  }

  function parseICSDate(str) {
    if (!str) return null;
    const clean = str.replace(/[^0-9]/g, '');
    const year = parseInt(clean.slice(0, 4));
    const month = parseInt(clean.slice(4, 6)) - 1;
    const day = parseInt(clean.slice(6, 8));
    return new Date(year, month, day);
  }

  function getDaysUntilBirthday(bdayDate, now) {
    const currentYear = now.getFullYear();
    let nextBday = new Date(currentYear, bdayDate.getMonth(), bdayDate.getDate());

    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (nextBday < todayMidnight) {
      nextBday = new Date(currentYear + 1, bdayDate.getMonth(), bdayDate.getDate());
    }

    const diffMs = nextBday - todayMidnight;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  function cleanPersonName(rawSummary) {
    let name = rawSummary || '';
    name = name
      .replace(/'s Birthday$/i, '')
      .replace(/^Birthday of /i, '')
      .replace(/^Geburtstag von /i, '')
      .replace(/ hat Geburtstag$/i, '')
      .replace(/'s Geburtstag$/i, '')
      .trim();
    return name;
  }

  function extractBirthYear(b) {
    const raw = `${b.summary || ''} ${b.description || ''}`;
    const m = raw.match(/(?:\(|\b)(19[2-9][0-9]|20[0-2][0-9])(?:\)|\b)/);
    if (m) {
      const yr = parseInt(m[1]);
      if (yr >= 1920 && yr <= new Date().getFullYear()) return yr;
    }
    return null;
  }

  function getZodiac(date) {
    if (!date) return null;
    const m = date.getMonth() + 1;
    const d = date.getDate();

    if ((m === 3 && d >= 21) || (m === 4 && d <= 20)) return { sign: 'Widder', icon: '♈', dates: '21.03. - 20.04.' };
    if ((m === 4 && d >= 21) || (m === 5 && d <= 20)) return { sign: 'Stier', icon: '♉', dates: '21.04. - 20.05.' };
    if ((m === 5 && d >= 21) || (m === 6 && d <= 21)) return { sign: 'Zwillinge', icon: '♊', dates: '21.05. - 21.06.' };
    if ((m === 6 && d >= 22) || (m === 7 && d <= 22)) return { sign: 'Krebs', icon: '♋', dates: '22.06. - 22.07.' };
    if ((m === 7 && d >= 23) || (m === 8 && d <= 23)) return { sign: 'Löwe', icon: '♌', dates: '23.07. - 23.08.' };
    if ((m === 8 && d >= 24) || (m === 9 && d <= 23)) return { sign: 'Jungfrau', icon: '♍', dates: '24.08. - 23.09.' };
    if ((m === 9 && d >= 24) || (m === 10 && d <= 23)) return { sign: 'Waage', icon: '♎', dates: '24.09. - 23.10.' };
    if ((m === 10 && d >= 24) || (m === 11 && d <= 22)) return { sign: 'Skorpion', icon: '♏', dates: '24.10. - 22.11.' };
    if ((m === 11 && d >= 23) || (m === 12 && d <= 21)) return { sign: 'Schütze', icon: '♐', dates: '23.11. - 21.12.' };
    if ((m === 12 && d >= 22) || (m === 1 && d <= 20)) return { sign: 'Steinbock', icon: '♑', dates: '22.12. - 20.01.' };
    if ((m === 1 && d >= 21) || (m === 2 && d <= 19)) return { sign: 'Wassermann', icon: '♒', dates: '21.01. - 19.02.' };
    return { sign: 'Fische', icon: '♓', dates: '20.02. - 20.03.' };
  }

  function extractContactInfo(b) {
    const desc = b.description || '';
    const text = desc.replace(/\n/g, '\n').replace(/\,/g, ',');

    // Phone
    const phoneMatch = text.match(/(?:tel:|phone:|mobil:|handy:|\+)[\s0-9()+-]{7,}/i) || text.match(/https?:\/\/wa\.me\/([0-9]+)/);
    let phone = phoneMatch ? (phoneMatch[1] || phoneMatch[0].replace(/[^0-9+]/g, '')) : '';
    if (phone && !phone.startsWith('+') && !phone.startsWith('00') && phone.startsWith('49')) {
      phone = '+' + phone;
    }

    // WhatsApp URL
    const waMatch = text.match(/https?:\/\/wa\.me\/([0-9]+)/);
    const waUrl = waMatch ? waMatch[0] : (phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}` : '');

    // Instagram URL
    const igMatch = text.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/) || text.match(/@([a-zA-Z0-9_.]{3,30})/);
    const igUrl = igMatch ? (igMatch[0].startsWith('http') ? igMatch[0] : `https://instagram.com/${igMatch[1]}`) : '';
    const igHandle = igMatch ? (igMatch[1] || igMatch[0].split('/').filter(Boolean).pop()) : '';

    // Email
    const mailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = mailMatch ? mailMatch[0] : '';

    // Google Contacts URL
    const contactUrlMatch = text.match(/https?:\/\/contacts\.google\.com\/[^\s\)]+/);
    const contactUrl = contactUrlMatch ? contactUrlMatch[0] : `https://contacts.google.com/search/${encodeURIComponent(cleanPersonName(b.summary))}`;

    // City / Location
    let city = HOMEBOARD_CONFIG.birthdays?.cities?.[cleanPersonName(b.summary)] || '';
    if (b.location && b.location.trim()) {
      city = b.location.split(',')[0].trim();
    } else {
      const cityMatch = text.match(/(?:wohnort|stadt|city|ort|lives in|location)[:\s]+([a-zA-ZäöüÄÖÜß\s-]+)/i);
      if (cityMatch) city = cityMatch[1].split(/[,\n]/)[0].trim();
    }

    return { phone, waUrl, igUrl, igHandle, email, contactUrl, city };
  }

  function extractContactLabels(b) {
    const labels = new Set();
    if (b.categories) {
      b.categories.split(/[,;]/).map(c => c.trim()).filter(Boolean).forEach(c => labels.add(c));
    }
    if (b.description) {
      const match = b.description.match(/(?:labels|tags|kategorien|gruppen|categories):\s*([^\r\n]+)/i);
      if (match) {
        match[1].split(/[,;]/).map(c => c.trim()).filter(Boolean).forEach(c => labels.add(c));
      }
    }
    const nameKey = cleanPersonName(b.summary);
    const cfgLabels = HOMEBOARD_CONFIG.birthdays?.labels?.[nameKey] || HOMEBOARD_CONFIG.cards?.birthdays?.labels?.[nameKey] || [];
    cfgLabels.forEach(l => labels.add(l));

    return Array.from(labels);
  }

  function render(birthdays) {
    const container = document.getElementById('birthdays-list');
    if (!container) return;

    if (birthdays.length === 0) {
      container.innerHTML = `<span class="birthday-none">${(window.i18n && typeof window.i18n === 'function') ? window.i18n('birthdays_none') : 'Keine Geburtstage'}</span>`;
      return;
    }

    // Deduplicate by name
    const seen = new Set();
    const unique = birthdays.filter(b => {
      const key = cleanPersonName(b.summary).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    _birthdaysList = unique;

    container.innerHTML = unique.map((b, idx) => {
      const name = cleanPersonName(b.summary);
      let when = '';
      const lang = (window.Lang && typeof window.Lang.get === 'function') ? window.Lang.get() : 'de';
      if (b.daysUntil === 0) when = lang === 'de' ? 'heute 🎉' : lang === 'es' ? 'hoy 🎉' : 'today 🎉';
      else if (b.daysUntil === 1) when = lang === 'de' ? 'morgen' : lang === 'es' ? 'mañana' : 'tomorrow';
      else when = lang === 'de' ? `in ${b.daysUntil} T.` : lang === 'es' ? `en ${b.daysUntil} d.` : `in ${b.daysUntil} d.`;

      const startsWithEmoji = /^[\p{Emoji}]/u.test(name);
      const info = extractContactInfo(b);

      const icons = {
        whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
        instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>'
      };

      const quickLinks = `
        ${info.waUrl ? `<a href="${info.waUrl}" target="_blank" class="birthday-social birthday-social-wa" title="WhatsApp" onclick="event.stopPropagation()">${icons.whatsapp}</a>` : ''}
        ${info.igUrl ? `<a href="${info.igUrl}" target="_blank" class="birthday-social birthday-social-ig" title="Instagram" onclick="event.stopPropagation()">${icons.instagram}</a>` : ''}
      `;

      return `<div class="birthday-item" onclick="Birthdays.showBirthdayDetail(${idx})" style="cursor: pointer;">
        <div class="birthday-main">
          ${startsWithEmoji ? '' : '<span class="birthday-icon">🎂</span>'}
          <span class="birthday-name">${name}</span>
        </div>
        <span class="birthday-links">${quickLinks}</span>
        <span class="birthday-when">${when}</span>
      </div>`;
    }).join('');
  }

  async function showBirthdayDetail(idx) {
    if (!_birthdaysList || !_birthdaysList[idx]) return;
    _currentModalIdx = idx;
    const b = _birthdaysList[idx];

    const existing = document.getElementById('birthday-detail-overlay');
    if (existing) existing.remove();
    if (_modalKeyHandler) window.removeEventListener('keydown', _modalKeyHandler);

    const name = cleanPersonName(b.summary);
    const firstName = name.split(' ')[0];
    const totalBday = _birthdaysList.length;
    const hasPrev = idx > 0;
    const hasNext = idx < totalBday - 1;

    const info = extractContactInfo(b);

    // Age calculation & milestone
    const now = new Date();
    const birthYear = extractBirthYear(b);
    let ageStr = '';
    let isMilestone = false;

    if (birthYear) {
      const currentYear = now.getFullYear();
      const turningAge = currentYear - birthYear;
      if (turningAge > 0 && turningAge < 120) {
        ageStr = `Wird ${turningAge} Jahre alt`;
        const milestoneList = HOMEBOARD_CONFIG.birthdays?.milestones || [18, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100];
        if (milestoneList.includes(turningAge)) {
          isMilestone = true;
          ageStr += ` · 🎂 Runder Geburtstag!`;
        }
      }
    }

    // Birthday date & day of week
    const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    let targetBdayDate = new Date(now.getFullYear(), b.start.getMonth(), b.start.getDate());
    const dowName = dayNames[targetBdayDate.getDay()];
    const dateFormatted = b.start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

    let whenDetail = '';
    if (b.daysUntil === 0) whenDetail = '🎉 Hat heute Geburtstag!';
    else if (b.daysUntil === 1) whenDetail = `Morgen (${dowName}, ${dateFormatted})`;
    else whenDetail = `In ${b.daysUntil} Tagen (${dowName}, ${dateFormatted})`;

    // Western Sternzeichen
    const zodiac = getZodiac(b.start);

    // Labels & Categories
    const labels = extractContactLabels(b);
    const labelsHtml = labels.length > 0
      ? `<div class="bday-labels-wrap">${labels.map(l => `<span class="bday-label-pill">${l}</span>`).join('')}</div>`
      : '';

    const overlay = document.createElement('div');
    overlay.id = 'birthday-detail-overlay';
    overlay.innerHTML = `
      <div class="event-detail-card birthday-detail-card">
        <div class="detail-modal-header">
          <span class="detail-modal-title">🎉 Geburtstag</span>
          <div class="detail-header-nav">
            ${totalBday > 1 ? `
              <button class="detail-nav-btn" ${!hasPrev ? 'disabled' : ''} onclick="Birthdays.navigateModal(-1)" title="Vorheriger Geburtstag (◀)">&lt;</button>
              <span class="detail-nav-count">${idx + 1}/${totalBday}</span>
              <button class="detail-nav-btn" ${!hasNext ? 'disabled' : ''} onclick="Birthdays.navigateModal(1)" title="Nächster Geburtstag (▶)">&gt;</button>
            ` : ''}
            <button class="detail-close-btn" aria-label="Close" onclick="Birthdays.closeModal()" title="Schließen (Esc)">✕</button>
          </div>
        </div>

        <div class="detail-hero-section" style="--event-accent: #f43f5e;">
          <div class="detail-title-row">
            <span class="detail-title">${name}</span>
          </div>
          <div class="detail-time-line">
            <span class="detail-time-text">${whenDetail}</span>
          </div>
          ${ageStr ? `<div class="detail-age-badge ${isMilestone ? 'milestone-glow' : ''}">${ageStr}</div>` : ''}
          ${labelsHtml}
        </div>

        <!-- Quick Contact Actions Bar -->
        <div class="bday-quick-actions-bar">
          ${info.waUrl ? `
            <a href="${info.waUrl}" target="_blank" class="detail-action-btn bday-action-btn bday-action-btn-wa">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          ` : `
            <a href="https://wa.me/?text=${encodeURIComponent(`Alles Gute zum Geburtstag, ${firstName}! 🎉🎂`)}" target="_blank" class="detail-action-btn bday-action-btn bday-action-btn-wa">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          `}
          ${info.igUrl ? `
            <a href="${info.igUrl}" target="_blank" class="detail-action-btn bday-action-btn bday-action-btn-ig">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              Instagram
            </a>
          ` : ''}
          <a href="${info.contactUrl}" target="_blank" class="detail-action-btn bday-action-btn">
            👤 Google Kontakte
          </a>
          ${info.phone ? `
            <a href="tel:${info.phone}" class="detail-action-btn bday-action-btn">
              📞 Anrufen
            </a>
          ` : ''}
        </div>

        <!-- Contact Information & Metadata -->
        <div class="detail-section-box">
          <div class="detail-section-title">
            <span>📋 Kontaktdaten & Infos</span>
          </div>
          <div class="bday-contact-grid">
            <div class="bday-meta-cell">
              <span class="bday-meta-icon">📅</span>
              <div>
                <strong>${dateFormatted}</strong>
                <div class="bday-meta-sub">${dowName}</div>
              </div>
            </div>
            ${zodiac ? `
              <div class="bday-meta-cell">
                <span class="bday-meta-icon">${zodiac.icon}</span>
                <div>
                  <strong>${zodiac.sign}</strong>
                  <div class="bday-meta-sub">${zodiac.dates}</div>
                </div>
              </div>
            ` : ''}
            ${info.city ? `
              <div class="bday-meta-cell" id="bday-city-cell">
                <span class="bday-meta-icon">📍</span>
                <div>
                  <strong>${info.city}</strong>
                  <div class="bday-meta-sub" id="bday-city-weather">Wetter wird geladen...</div>
                </div>
              </div>
            ` : ''}
            ${info.phone ? `
              <div class="bday-meta-cell">
                <span class="bday-meta-icon">📞</span>
                <div>
                  <strong>${info.phone}</strong>
                  <div class="bday-meta-sub">Telefonnummer</div>
                </div>
              </div>
            ` : ''}
            ${info.email ? `
              <div class="bday-meta-cell">
                <span class="bday-meta-icon">✉️</span>
                <div>
                  <strong><a href="mailto:${info.email}" style="color: inherit; text-decoration: none;">${info.email}</a></strong>
                  <div class="bday-meta-sub">E-Mail Adresse</div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Actions Bar -->
        <div class="detail-actions-bar">
          <button class="detail-action-btn" onclick="Birthdays.copyWishQuick('${firstName.replace(/'/g, "\'")}', this)">
            📋 Glückwunsch kopieren
          </button>
          <button class="detail-action-btn" onclick="Birthdays.closeModal()">
            Schließen
          </button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('detail-close-btn')) {
        closeModal();
      }
    });

    _modalKeyHandler = (e) => {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowLeft') navigateModal(-1);
      else if (e.key === 'ArrowRight') navigateModal(1);
    };
    window.addEventListener('keydown', _modalKeyHandler);

    document.body.appendChild(overlay);

    // If city is specified, fetch its local weather
    if (info.city) {
      fetchCityWeather(info.city);
    }
  }

  async function fetchCityWeather(cityName) {
    const weatherSub = document.getElementById('bday-city-weather');
    if (!weatherSub) return;

    try {
      const geoUrl = `/proxy?url=${encodeURIComponent(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=de&format=json`)}`;
      const res = await fetch(geoUrl);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.results && data.results.length) {
        const place = data.results[0];
        const mUrl = `/proxy?url=${encodeURIComponent(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=auto`)}`;
        const mRes = await fetch(mUrl);
        if (mRes.ok) {
          const mData = await mRes.json();
          const temp = Math.round(mData.current.temperature_2m);
          weatherSub.textContent = `Aktuell ${temp}°C`;
        }
      }
    } catch (e) {
      weatherSub.textContent = 'Wohnort';
    }
  }

  function copyWishQuick(firstName, btn) {
    const customTpl = HOMEBOARD_CONFIG.birthdays?.whatsappTemplate;
    const text = customTpl ? customTpl.replace('{name}', firstName) : `Liebe/r ${firstName}, alles Liebe und Gute zum Geburtstag! Ich wünsche dir ein fantastisches neues Lebensjahr, viel Gesundheit und Glück! Lass dich heute ordentlich feiern! 🎉🎂`;
    if (typeof window.copyToClipboard === 'function') {
      window.copyToClipboard(text, btn, 'Wunsch kopiert! ✓');
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = '✓ Text kopiert!';
          setTimeout(() => { btn.innerHTML = orig; }, 1800);
        }
      }).catch(() => {});
    }
  }

  function navigateModal(direction) {
    if (_currentModalIdx === -1 || !_birthdaysList.length) return;
    const next = _currentModalIdx + direction;
    if (next >= 0 && next < _birthdaysList.length) {
      showBirthdayDetail(next);
    }
  }

  function closeModal() {
    const existing = document.getElementById('birthday-detail-overlay');
    if (existing) existing.remove();
    if (_modalKeyHandler) {
      window.removeEventListener('keydown', _modalKeyHandler);
      _modalKeyHandler = null;
    }
  }

  return { init, showBirthdayDetail, copyWishQuick, navigateModal, closeModal };
})();
