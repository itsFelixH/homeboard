const fs = require('fs');
const path = require('path');

describe('Birthdays Module', () => {
  beforeEach(() => {
    global.resetDOM();
    HOMEBOARD_CONFIG = {
      birthdays: {
        icsUrl: 'https://example.com/birthdays.ics',
        lookaheadDays: 14,
        refreshMinutes: 60
      }
    };
    jest.restoreAllMocks();
  });

  test('fetches and renders upcoming birthdays from ICS feed', async () => {
    // Set system time to match fixture birthday: 2026-09-19
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 19, 12, 0, 0));

    const icsText = fs.readFileSync(path.join(__dirname, 'fixtures/birthdays.ics'), 'utf8');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => icsText
    });

    Birthdays.init();
    await Promise.resolve(); // flush microtasks
    await Promise.resolve();

    const list = document.getElementById('birthdays-list');
    expect(list.innerHTML).toContain('Max Mustermann');
    expect(list.innerHTML).toContain('heute');

    jest.useRealTimers();
  });

  test('deduplicates duplicate events for the same person and merges contact links', async () => {
    // Today is 2026-09-20, birthday is on 2026-09-26 (in 6 days)
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 20, 12, 0, 0));

    const duplicateIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:bday-1@google.com',
      'DTSTART;VALUE=DATE:20260926',
      'SUMMARY:Jennifer Ruby',
      'DESCRIPTION:tel:+491701234567\\nhttps://wa.me/491701234567',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:bday-2@google.com',
      'DTSTART;VALUE=DATE:20260926',
      'SUMMARY:🎉 Jennifer Ruby wird 30! 🎉',
      'DESCRIPTION:https://instagram.com/jennifer_ruby\\nhttps://wa.me/491701234567',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => duplicateIcs
    });

    Birthdays.init();
    await Promise.resolve();
    await Promise.resolve();

    const list = document.getElementById('birthdays-list');
    const items = list.querySelectorAll('.birthday-item');

    // Exactly 1 item should be rendered instead of 2
    expect(items.length).toBe(1);

    const nameEl = list.querySelector('.birthday-name');
    expect(nameEl.textContent).toBe('Jennifer Ruby');

    // Both WhatsApp and Instagram links should be merged in quick links
    expect(list.innerHTML).toContain('birthday-social-wa');
    expect(list.innerHTML).toContain('birthday-social-ig');
    expect(list.innerHTML).toContain('in 6 T.');

    // Clicking detail modal should show milestone info
    Birthdays.showBirthdayDetail(0);
    const overlay = document.getElementById('birthday-detail-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.innerHTML).toContain('Wird 30 Jahre alt');
    expect(overlay.innerHTML).toContain('Runder Geburtstag');
    Birthdays.closeModal();

    jest.useRealTimers();
  });

  test('renders empty state when no birthdays fall within lookahead window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 5, 1, 12, 0, 0)); // June 1st (none in window)

    const icsText = fs.readFileSync(path.join(__dirname, 'fixtures/birthdays.ics'), 'utf8');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => icsText
    });

    Birthdays.init();
    await Promise.resolve();
    await Promise.resolve();

    const list = document.getElementById('birthdays-list');
    expect(list.innerHTML).toContain('Keine Geburtstage');

    jest.useRealTimers();
  });

  test('handles fetch errors gracefully and shows error label', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    Birthdays.init();
    await Promise.resolve();
    await Promise.resolve();

    const list = document.getElementById('birthdays-list');
    expect(list.innerHTML).toContain('birthday-error');
    consoleSpy.mockRestore();
  });
  test('filters out overview events like 🎉🎂 GEBURTSTAGE 🎂🎉', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 20, 12, 0, 0));

    const icsText = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:overview-1@google.com',
      'DTSTART;VALUE=DATE:20260920',
      'SUMMARY:🎉🎂 GEBURTSTAGE 🎂🎉',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:bday-valid@google.com',
      'DTSTART;VALUE=DATE:20260921',
      'SUMMARY:Felix Hoffmann',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => icsText
    });

    Birthdays.init();
    await Promise.resolve();
    await Promise.resolve();

    const list = document.getElementById('birthdays-list');
    expect(list.innerHTML).not.toContain('GEBURTSTAGE');
    expect(list.innerHTML).toContain('Felix Hoffmann');

    jest.useRealTimers();
  });
});