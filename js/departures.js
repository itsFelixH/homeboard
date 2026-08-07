/**
 * Departures module - S-Bahn departures from Savignyplatz
 * Split by direction: Stadtmitte (east) and Westkreuz (west)
 *
 * Uses VBB HAFAS API (with access key) or falls back to v6.vbb.transport.rest
 */
const Departures = (() => {
  let refreshInterval;

  // Directions heading west
  const WEST_KEYWORDS = ['Spandau', 'Westkreuz', 'Olympia', 'Wannsee', 'Potsdam', 'Stresow', 'Grunewald', 'Pichelsberg', 'Charlottenburg'];

  function init() {
    const config = HOMEBOARD_CONFIG.departures;
    if (!config.stopId) return;
    fetchDepartures();
    refreshInterval = setInterval(fetchDepartures, config.refreshSeconds * 1000);
  }

  async function fetchDepartures() {
    const config = HOMEBOARD_CONFIG.departures;

    if (config.hafasAccessId) {
      await fetchHAFAS(config);
    } else {
      await fetchTransportRest(config);
    }
  }

  async function fetchHAFAS(config) {
    const url = `https://vbb.demo.hafas.cloud/api/fahrinfo/latest/departureBoard?` +
      `accessId=${config.hafasAccessId}` +
      `&extId=${config.stopId}` +
      `&format=json` +
      `&maxJourneys=20` +
      `&products=1`; // products=1 = S-Bahn only

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const departures = (data.Departure || []).map(dep => ({
        line: dep.name ? dep.name.trim() : '--',
        direction: (dep.direction || '').replace(' (Berlin)', '').replace(' Bhf', ''),
        time: dep.rtTime || dep.time || '',
        delay: calculateDelay(dep.time, dep.rtTime),
        lineColor: dep.ProductAtStop?.icon?.backgroundColor?.hex || '#6366f1'
      }));
      renderSplit(departures);
    } catch (err) {
      console.error('HAFAS departures fetch failed:', err);
      await fetchTransportRest(config); // Fallback
    }
  }

  function calculateDelay(planned, realtime) {
    if (!planned || !realtime || planned === realtime) return 0;
    const [ph, pm] = planned.split(':').map(Number);
    const [rh, rm] = realtime.split(':').map(Number);
    return (rh * 60 + rm) - (ph * 60 + pm);
  }

  async function fetchTransportRest(config) {
    const params = new URLSearchParams({
      duration: config.durationMinutes.toString(),
      results: '20',
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
      const departures = (data.departures || []).map(dep => ({
        line: dep.line ? dep.line.name : '--',
        direction: (dep.direction || '').replace(' (Berlin)', '').replace(' Bhf', ''),
        time: formatTimeISO(dep.when || dep.plannedWhen),
        delay: dep.delay ? Math.round(dep.delay / 60) : 0,
        lineColor: dep.line?.color?.bg || '#6366f1'
      }));
      renderSplit(departures);
    } catch (err) {
      console.error('Departures fetch failed:', err);
      const msg = `<tr><td colspan="4" class="departures-empty">Error</td></tr>`;
      document.getElementById('departures-west').innerHTML = msg;
      document.getElementById('departures-east').innerHTML = msg;
    }
  }

  function renderSplit(departures) {
    const west = [];
    const east = [];

    for (const dep of departures) {
      if (WEST_KEYWORDS.some(kw => dep.direction.includes(kw))) {
        west.push(dep);
      } else {
        east.push(dep);
      }
    }

    const max = HOMEBOARD_CONFIG.departures.maxResults || 5;
    renderTable('departures-east', east.slice(0, max));
    renderTable('departures-west', west.slice(0, max));
  }

  function renderTable(elementId, departures) {
    const tbody = document.getElementById(elementId);

    if (departures.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="departures-empty">--</td></tr>`;
      return;
    }

    tbody.innerHTML = departures.map(dep => {
      const delay = dep.delay > 0 ? `+${dep.delay}` : '';
      const timeDisplay = dep.time.slice(0, 5); // HH:MM

      return `<tr>
        <td><span class="dep-line" style="background:${dep.lineColor}">${dep.line}</span></td>
        <td class="dep-direction">${dep.direction}</td>
        <td class="dep-time">${timeDisplay}</td>
        <td class="dep-delay">${delay}</td>
      </tr>`;
    }).join('');
  }

  function formatTimeISO(isoString) {
    if (!isoString) return '--:--';
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  return { init };
})();
