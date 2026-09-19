describe('Clock', () => {
  beforeEach(() => {
    global.resetDOM();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('updates time and date in the topbar elements', () => {
    jest.setSystemTime(new Date(2026, 8, 19, 14, 30, 0)); // 2026-09-19 14:30:00

    Clock.init();

    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');

    expect(timeEl.textContent).toBe('14:30');
    expect(dateEl.textContent.length).toBeGreaterThan(0);

    // Fast-forward 1 hour
    jest.advanceTimersByTime(3600 * 1000);
    expect(timeEl.textContent).toBe('15:30');
  });
});
