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
});
