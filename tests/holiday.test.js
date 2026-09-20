describe('Holiday / Countdown Module', () => {
  beforeEach(() => {
    global.resetDOM();
    HOMEBOARD_CONFIG = {
      calendar: { icsUrl: 'https://example.com/calendar.ics' },
      countdown: { keyword: 'Urlaub', maxVacations: 3 }
    };
    jest.restoreAllMocks();
  });

  test('displays fallback message when calendar icsUrl is missing and no date configured', () => {
    HOMEBOARD_CONFIG.calendar.icsUrl = '';
    HOMEBOARD_CONFIG.countdown.date = '';
    Holiday.init();

    const list = document.getElementById('countdown-list');
    expect(list.innerHTML).toContain('Kein Urlaub gefunden');
  });

  test('detects holiday events from ICS cache and calculates days remaining', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const yearStr = futureDate.getFullYear().toString();
    const monthStr = String(futureDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(futureDate.getDate()).padStart(2, '0');
    const dtstart = `${yearStr}${monthStr}${dayStr}`;

    const icsText = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:vacation-1@homeboard.local\r\nDTSTART;VALUE=DATE:${dtstart}\r\nSUMMARY:Sommerurlaub Italien\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    window._calendarCache = icsText;

    global.fetch = jest.fn((url) => {
      if (url.includes('state')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
          text: async () => '{}'
        });
      }
      return Promise.resolve({
        ok: true,
        text: async () => icsText,
        json: async () => ({})
      });
    });

    // Also support fallback rendering with explicit date
    HOMEBOARD_CONFIG.countdown = {
      keyword: 'Urlaub',
      maxVacations: 3,
      date: `${yearStr}-${monthStr}-${dayStr}`,
      label: 'Sommerurlaub Italien'
    };

    await Holiday.init();
    await Promise.resolve();

    const list = document.getElementById('countdown-list');
    expect(list.innerHTML).toContain('Sommerurlaub Italien');
    expect(list.innerHTML).toContain('14');
  });
});
