describe('Commute Module', () => {
  beforeEach(() => {
    global.resetDOM();
    HOMEBOARD_CONFIG = {
      location: { latitude: 52.52, longitude: 13.405 },
      commute: {
        origin: { latitude: 52.52, longitude: 13.405 },
        destinations: [{ label: 'Work Office', latitude: 52.51, longitude: 13.38 }],
        refreshMinutes: 10,
        showBike: true,
        showTransit: true,
        bikeSpeed: 13,
        targetDepartureNextDay: '06:00'
      },
      departures: {}
    };
    jest.restoreAllMocks();
  });

  test('displays message when no destinations configured', () => {
    HOMEBOARD_CONFIG.commute.destinations = [];
    Commute.init();

    const el = document.getElementById('commute-list');
    expect(el.innerHTML).toContain('Set destinations in config');
  });

  test('fetches route details and renders destination label and ETA', async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes('router.project-osrm.org')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code: 'Ok',
            routes: [{ duration: 1200, distance: 5000 }]
          })
        });
      }
      if (url.includes('api.transitous.org')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            itineraries: [{
              duration: 1500,
              startTime: new Date('2026-09-21T06:00:00Z').getTime(),
              endTime: new Date('2026-09-21T06:25:00Z').getTime(),
              legs: [{ mode: 'SUBWAY', route: 'U2', duration: 1500, from: { name: 'Alex' }, to: { name: 'Office' } }]
            }]
          })
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404
      });
    });

    Commute.init();
    await new Promise(r => setTimeout(r, 50));

    const el = document.getElementById('commute-list');
    expect(el.innerHTML).toContain('Work Office');
    // Ensure schedule badge was removed from header
    expect(el.querySelector('.commute-schedule-badge')).toBeNull();
  });

  test('defaults digitalcampus to ÖPNV (transit) and renders emoji leave hint on selected option only', async () => {
    HOMEBOARD_CONFIG.commute.destinations = [
      { label: 'Digitalcampus', latitude: 52.5025, longitude: 13.4753 }
    ];

    global.fetch = jest.fn((url) => {
      if (url.includes('router.project-osrm.org')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code: 'Ok',
            routes: [{ duration: 1200, distance: 5000 }]
          })
        });
      }
      if (url.includes('api.transitous.org')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            itineraries: [{
              duration: 1500,
              startTime: new Date('2026-09-21T06:01:00Z').getTime(),
              endTime: new Date('2026-09-21T06:26:00Z').getTime(),
              legs: [{ mode: 'SUBWAY', route: 'U2', duration: 1500, from: { name: 'Alex' }, to: { name: 'Office' } }]
            }]
          })
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    Commute.init();
    await new Promise(r => setTimeout(r, 50));

    const el = document.getElementById('commute-list');
    const routeLines = el.querySelectorAll('.commute-route-line');
    expect(routeLines.length).toBe(2);

    // Bike line (top) should not have the preferred class nor the leave badge
    const bikeLine = routeLines[0];
    expect(bikeLine.classList.contains('commute-route-preferred')).toBe(false);
    expect(bikeLine.querySelector('.commute-route-right')).toBeNull();

    // Transit line (bottom) should be preferred and have the leave badge with emoji and weekday
    const transitLine = routeLines[1];
    expect(transitLine.classList.contains('commute-route-preferred')).toBe(true);
    const badge = transitLine.querySelector('.commute-route-right');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toMatch(/🚇.*los um/);

    // When clicking bike mode, preference and badge should toggle to bike
    Commute.selectMode(0, 'bike');
    const updatedBike = el.querySelectorAll('.commute-route-line')[0];
    const updatedTransit = el.querySelectorAll('.commute-route-line')[1];
    expect(updatedBike.classList.contains('commute-route-preferred')).toBe(true);
    expect(updatedBike.querySelector('.commute-route-right').textContent).toMatch(/🚲.*los um/);
    expect(updatedTransit.querySelector('.commute-route-right')).toBeNull();
  });
});