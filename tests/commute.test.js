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
        bikeSpeed: 13
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
    // Wait for all async promises in fetchAll and fetchRoute to settle
    await new Promise(r => setTimeout(r, 50));

    const el = document.getElementById('commute-list');
    expect(el.innerHTML).toContain('Work Office');
  });
});
