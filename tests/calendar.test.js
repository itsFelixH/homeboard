const fs = require('fs');
const path = require('path');

describe('Calendar Module', () => {
  beforeEach(() => {
    global.resetDOM();
    HOMEBOARD_CONFIG = {
      location: { latitude: 52.52, longitude: 13.405, address: 'Alexanderplatz, 10178 Berlin' },
      calendar: {
        icsUrl: 'https://example.com/calendar.ics',
        maxEvents: 5,
        refreshMinutes: 30,
        showTomorrow: true,
        showCommute: false,
        hidePatterns: ['ignore-me']
      }
    };
    jest.restoreAllMocks();
  });

  test('fetches, parses and renders calendar events for today', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 19, 8, 0, 0));

    const icsText = fs.readFileSync(path.join(__dirname, 'fixtures/calendar.ics'), 'utf8');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => icsText
    });

    Calendar.init();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const list = document.getElementById('event-list');
    expect(list.innerHTML).toContain('Team Standup');
    expect(list.innerHTML).toContain('Project Deadline');

    jest.useRealTimers();
  });

  test('filters out events matching hidePatterns', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 19, 8, 0, 0));

    HOMEBOARD_CONFIG.calendar.hidePatterns = ['Standup'];

    const icsText = fs.readFileSync(path.join(__dirname, 'fixtures/calendar.ics'), 'utf8');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => icsText
    });

    Calendar.init();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const list = document.getElementById('event-list');
    expect(list.innerHTML).not.toContain('Team Standup');
    expect(list.innerHTML).toContain('Project Deadline');

    jest.useRealTimers();
  });

  test('displays empty placeholder when icsUrl is empty', () => {
    HOMEBOARD_CONFIG.calendar.icsUrl = '';
    Calendar.init();

    const list = document.getElementById('event-list');
    expect(list.textContent).toContain('Set icsUrl in config');
  });

  test('navigates between calendar event details in-place without destroying overlay backdrop', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 20, 8, 0, 0));

    const multiEventIcs = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:e1@test.com',
      'DTSTART:20260920T090000Z',
      'DTEND:20260920T100000Z',
      'SUMMARY:Morning Meeting',
      'LOCATION:Office',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:e2@test.com',
      'DTSTART:20260920T140000Z',
      'DTEND:20260920T150000Z',
      'SUMMARY:Afternoon Sync',
      'LOCATION:Office',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => multiEventIcs
    });

    Calendar.init();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    Calendar.showEventDetailByIdx(0);
    const initialOverlay = document.getElementById('event-detail-overlay');
    expect(initialOverlay).not.toBeNull();
    expect(initialOverlay.innerHTML).toContain('Morning Meeting');

    Calendar.navigateEventDetail(1);
    const nextOverlay = document.getElementById('event-detail-overlay');
    expect(nextOverlay).toBe(initialOverlay);
    expect(nextOverlay.innerHTML).toContain('Afternoon Sync');
    expect(nextOverlay.querySelector('.modal-nav-next')).not.toBeNull();

    Calendar.navigateEventDetail(-1);
    const prevOverlay = document.getElementById('event-detail-overlay');
    expect(prevOverlay).toBe(initialOverlay);
    expect(prevOverlay.innerHTML).toContain('Morning Meeting');
    expect(prevOverlay.querySelector('.modal-nav-prev')).not.toBeNull();

    Calendar.closeEventDetail();
    expect(document.getElementById('event-detail-overlay')).toBeNull();
    jest.useRealTimers();
  });
});
