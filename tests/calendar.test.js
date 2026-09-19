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
});
