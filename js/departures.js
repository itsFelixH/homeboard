/**
 * Departures module - S-Bahn departures from Savignyplatz
 * Uses v6.vbb.transport.rest (free, no key, CORS enabled)
 * https://v6.vbb.transport.rest/
 */
const Departures = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.departures;
    if (!config.stopId) {
      document.getElementById('departures-list').innerHTML =
        '<tr><td colspan="4" class="departures-empty">Set stopId in config.js</td></tr>';
      return;
    }
    fetchDepartures();
    refreshInterval = setInterval(fetchDepartures, config.refreshSeconds * 1000);
  }

  async function fetchDepartures() {
    const config = HOMEBOARD_CONFIG.departures;
    const params = new URLSearchParams({
      duration: config.durationMinutes.toString(),
      results: config.maxResults.toString(),
      suburban: 'true',
      subway: 'false',
      tram: 'false',
      bus: 'false',
      ferry: 'false',
      express: 'false',
      regional: 'false'
    });

    const url = `https://v6.vbb.transport.rest/stops/${config.stopId}/departures?${params}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data.departures || []);
    } catch (err) {
      console.error('Departures fetch failed:', err);
      document.getElementById('departures-list').innerHTML =
        '<tr><td colspan="4" class="departures-empty">Error loading departures</td></tr>';
    }
  }

  function render(departures) {
    const tbody = document.getElementById('departures-list');

    if (departures.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="departures-empty">No departures found</td></tr>';
      return;
    }

    tbody.innerHTML = departures.map(dep => {
      const when = dep.when || dep.plannedWhen;
      const time = formatTime(when);
      const delay = dep.delay ? `+${Math.round(dep.delay / 60)}` : '';
      const line = dep.line ? dep.line.name : '--';
      const direction = dep.direction || '--';
      const lineColor = dep.line && dep.line.color ? dep.line.color.bg : 'var(--accent)';

      return `<tr>
        <td><span class="dep-line" style="background:${lineColor}">${line}</span></td>
        <td class="dep-direction">${shortenDirection(direction)}</td>
        <td class="dep-time">${time}</td>
        <td class="dep-delay">${delay}</td>
      </tr>`;
    }).join('');
  }

  function formatTime(isoString) {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  function shortenDirection(dir) {
    // Remove common suffixes for cleaner display
    return dir
      .replace(' (Berlin)', '')
      .replace(' Bhf', '')
      .replace('S ', '');
  }

  return { init };
})();
