/**
 * BVG/VBB Disruptions module - shows current service alerts
 * Uses v6.vbb.transport.rest departures endpoint (warnings come with departures)
 * or the stop's remarks
 */
const Disruptions = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.departures;
    if (!config.stopId) return;
    fetchDisruptions();
    refreshInterval = setInterval(fetchDisruptions, 5 * 60 * 1000); // every 5 min
  }

  async function fetchDisruptions() {
    const config = HOMEBOARD_CONFIG.departures;
    const url = `https://v6.vbb.transport.rest/stops/${config.stopId}/departures?duration=60&results=10&suburban=true`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const warnings = extractWarnings(data.departures || []);
      render(warnings);
    } catch (err) {
      console.error('Disruptions fetch failed:', err);
      document.getElementById('disruptions-list').innerHTML =
        '<div class="disruption-item disruption-ok">Could not check disruptions</div>';
    }
  }

  function extractWarnings(departures) {
    const seen = new Set();
    const warnings = [];

    for (const dep of departures) {
      if (!dep.remarks) continue;
      for (const remark of dep.remarks) {
        if (remark.type === 'warning' && remark.summary && !seen.has(remark.summary)) {
          seen.add(remark.summary);
          warnings.push({
            summary: remark.summary,
            line: dep.line ? dep.line.name : ''
          });
        }
      }
    }

    return warnings;
  }

  function render(warnings) {
    const container = document.getElementById('disruptions-list');

    if (warnings.length === 0) {
      // Hide completely when no disruptions
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = warnings.slice(0, 3).map(w => {
      const lineTag = w.line ? `<span class="disruption-line">${w.line}</span>` : '';
      return `<div class="disruption-item">${lineTag}${w.summary}</div>`;
    }).join('');
  }

  return { init };
})();
