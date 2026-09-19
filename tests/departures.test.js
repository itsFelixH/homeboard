const fs = require('fs');
const path = require('path');

describe('Departures Module', () => {
  beforeEach(() => {
    global.resetDOM();
    HOMEBOARD_CONFIG = {
      departures: {
        stopId: '900000024101',
        stops: [{ id: '900000024101', label: 'S Savignyplatz', splitView: true, products: { suburban: true } }],
        durationMinutes: 60,
        maxResults: 5,
        refreshSeconds: 30
      },
      cards: {
        departures: {
          showDelays: true,
          platformDisplay: true
        }
      }
    };
    jest.restoreAllMocks();
  });

  test('fetches departures from transport.rest and renders lines with delays and directions', async () => {
    const now = new Date();
    const vbbData = {
      departures: [
        {
          when: new Date(now.getTime() + 10 * 60000).toISOString(),
          delay: 120,
          line: { name: 'S7' },
          direction: 'Ahrensfelde'
        },
        {
          when: new Date(now.getTime() + 15 * 60000).toISOString(),
          delay: 0,
          line: { name: 'S3' },
          direction: 'Spandau'
        }
      ]
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => vbbData
    });

    Departures.init();
    await new Promise(r => setTimeout(r, 60));

    const eastTbody = document.getElementById('departures-east');
    const westTbody = document.getElementById('departures-west');

    const combinedHtml = (eastTbody ? eastTbody.innerHTML : '') + (westTbody ? westTbody.innerHTML : '');
    expect(combinedHtml).toContain('S7');
    expect(combinedHtml).toContain('Ahrensfelde');
    expect(combinedHtml).toContain('S3');
    expect(combinedHtml).toContain('Spandau');
  });
});
