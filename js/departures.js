/**
 * Departures module - real-time departures from multiple stops
 * Interactive: click dots to switch between stops
 *
 * Uses VBB HAFAS API (with access key) or falls back to v6.vbb.transport.rest
 */
const Departures = (() => {
  let refreshInterval;
  let currentIndex = 0;
  let cachedData = []; // Array of { stop, departures[] }

  // Directions heading west (for S-Bahn split view)
  const WEST_KEYWORDS = ['Spandau', 'Westkreuz', 'Olympia', 'Wannsee', 'Potsdam', 'Stresow', 'Grunewald', 'Pichelsberg', 'Charlottenburg'];

  function init() {
    const config = HOMEBOARD_CONFIG.departures;
    if (!config.stops || config.stops.length === 0) {
      // Fallback: single stop from legacy config
      if (config.stopId) {
        config.stops = [{ id: config.stopId, label: 'Departures', products: {} }];
      } else {
        return;
      }
    }
    cachedData = config.stops.map(s => ({ stop: s, departures: [] }));
    fetchAll();
    refreshInterval = setInterval(fetchAll, config.refreshSeconds * 1000);
  }

  async function fetchAll() {
    const config = HOMEBOARD_CONFIG.departures;
    await Promise.all(config.stops.map((stop, i) => fetchStop(stop, i, config)));
    render();
  }

  async function fetchStop(stop, index, config) {
    if (config.hafasAccessId) {
      await fetchHAFAS(stop, index, config);
    } else {
      await fetchTransportRest(stop, index, config);
    }
  }

  async function fetchHAFAS(stop, index, config) {
    const products = stop.products || {};
    const params = new URLSearchParams({
      accessId: config.hafasAccessId,
      extId: stop.id,
      format: 'json',
      maxJourneys: '20'
    });

    // Build HAFAS products bitmask from individual flags
    // 1=S-Bahn, 2=U-Bahn, 4=Tram, 8=Bus, 16=Ferry, 32=ICE/Express, 64=Regional
    if (products.filter) {
      params.set('products', products.filter);
    } else {
      let bitmask = 0;
      if (products.suburban) bitmask += 1;
      if (products.subway) bitmask += 2;
      if (products.tram) bitmask += 4;
      if (products.bus) bitmask += 8;
      if (products.ferry) bitmask += 16;
      if (products.express) bitmask += 32;
      if (products.regional) bitmask += 64;
      if (bitmask > 0) params.set('products', bitmask.toString());
    }

    const url = `https://vbb.demo.hafas.cloud/api/fahrinfo/latest/departureBoard?${params}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cachedData[index].departures = (data.Departure || []).map(dep => ({
        line: dep.name ? dep.name.trim() : '--',
        direction: (dep.direction || '').replace(' (Berlin)', '').replace(' Bhf', ''),
        time: dep.rtTime || dep.time || '',
        delay: calculateDelay(dep.time, dep.rtTime),
        lineColor: dep.ProductAtStop?.icon?.backgroundColor?.hex || '#6366f1'
      }));
    } catch (err) {
      console.error(`HAFAS departures fetch failed for ${stop.label}:`, err);
      await fetchTransportRest(stop, index, config);
    }
  }

  async function fetchTransportRest(stop, index, config) {
    const products = stop.products || {};
    const params = new URLSearchParams({
      duration: (config.durationMinutes || 30).toString(),
      results: '20',
      suburban: (products.suburban !== false && products.filter === undefined) ? 'true' : (products.suburban ? 'true' : 'false'),
      subway: products.subway ? 'true' : 'false',
      tram: products.tram ? 'true' : 'false',
      bus: products.bus ? 'true' : 'false',
      ferry: 'false',
      express: 'false',
      regional: 'false'
    });

    const url = `https://v6.vbb.transport.rest/stops/${stop.id}/departures?${params}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cachedData[index].departures = (data.departures || []).map(dep => ({
        line: dep.line ? dep.line.name : '--',
        direction: (dep.direction || '').replace(' (Berlin)', '').replace(' Bhf', ''),
        time: formatTimeISO(dep.when || dep.plannedWhen),
        delay: dep.delay ? Math.round(dep.delay / 60) : 0,
        lineColor: dep.line?.color?.bg || '#6366f1'
      }));
    } catch (err) {
      console.error(`Departures fetch failed for ${stop.label}:`, err);
      cachedData[index].departures = [];
    }
  }

  function calculateDelay(planned, realtime) {
    if (!planned || !realtime || planned === realtime) return 0;
    const [ph, pm] = planned.split(':').map(Number);
    const [rh, rm] = realtime.split(':').map(Number);
    let diff = (rh * 60 + rm) - (ph * 60 + pm);
    // Handle midnight wraparound
    if (diff < -720) diff += 1440;
    if (diff > 720) diff -= 1440;
    return diff;
  }

  function switchTo(index) {
    currentIndex = index;
    render();
  }

  function render() {
    if (cachedData.length === 0) return;

    const config = HOMEBOARD_CONFIG.departures;
    const current = cachedData[currentIndex];
    const stop = current.stop;
    const departures = current.departures;

    // Update header label
    const headerLabel = document.querySelector('.card-departures .card-header span[data-i18n="departures"]');
    if (headerLabel) headerLabel.textContent = stop.label;

    // Arrow navigation
    let navHtml = '';
    if (cachedData.length > 1) {
      const prevIdx = (currentIndex - 1 + cachedData.length) % cachedData.length;
      const nextIdx = (currentIndex + 1) % cachedData.length;
      navHtml = `<div class="card-nav">
        <button class="card-nav-btn" onclick="Departures.switchTo(${prevIdx})" aria-label="Previous">‹</button>
        <span class="card-nav-label">${currentIndex + 1}/${cachedData.length}</span>
        <button class="card-nav-btn" onclick="Departures.switchTo(${nextIdx})" aria-label="Next">›</button>
      </div>`;
    }

    // Render nav container
    let navContainer = document.querySelector('.card-departures .departures-dots');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.className = 'departures-dots';
      const header = document.querySelector('.card-departures .card-header');
      if (header) header.appendChild(navContainer);
    }
    navContainer.innerHTML = navHtml;

    // Decide layout: split for S-Bahn stops, list for others
    const splitEl = document.querySelector('.card-departures .departures-split');
    const listEl = document.getElementById('departures-list-view');

    if (stop.splitView) {
      // Split view — divide departures into two groups by direction
      if (splitEl) splitEl.style.display = 'grid';
      if (listEl) listEl.style.display = 'none';

      const labels = stop.splitLabels || ['→', '←'];
      // Update direction labels
      const dirLabels = document.querySelectorAll('.card-departures .dep-dir-label');
      if (dirLabels[0]) dirLabels[0].textContent = labels[0];
      if (dirLabels[1]) dirLabels[1].textContent = labels[1];

      const { east, west } = splitByDirection(departures, stop);
      const max = config.maxResults || 5;
      renderTable('departures-east', east.slice(0, max));
      renderTable('departures-west', west.slice(0, max));
    } else {
      // List view
      if (splitEl) splitEl.style.display = 'none';
      if (!listEl) {
        const container = document.createElement('div');
        container.id = 'departures-list-view';
        const splitParent = splitEl?.parentNode;
        if (splitParent) splitParent.appendChild(container);
      }
      const lv = document.getElementById('departures-list-view');
      if (lv) {
        lv.style.display = 'block';
        const max = config.maxResults || 5;
        renderListView(lv, departures.slice(0, max));
      }
    }
  }

  function splitByDirection(departures, stop) {
    // Use splitKeywords if provided, otherwise split evenly by unique directions
    const keywords = stop.splitKeywords || WEST_KEYWORDS;
    const east = [];
    const west = [];

    for (const dep of departures) {
      if (keywords.some(kw => dep.direction.includes(kw))) {
        west.push(dep);
      } else {
        east.push(dep);
      }
    }

    // If no keyword match at all, split by alternating unique directions
    if (west.length === 0 && east.length > 1) {
      const dirs = [...new Set(departures.map(d => d.direction))];
      const halfDirs = new Set(dirs.slice(0, Math.ceil(dirs.length / 2)));
      for (const dep of departures) {
        if (halfDirs.has(dep.direction)) {
          east.push(dep);
        } else {
          west.push(dep);
        }
      }
      east.length = 0; // Clear previous
      // Redo properly
      const eastDeps = [];
      const westDeps = [];
      for (const dep of departures) {
        if (halfDirs.has(dep.direction)) {
          eastDeps.push(dep);
        } else {
          westDeps.push(dep);
        }
      }
      return { east: eastDeps, west: westDeps };
    }

    return { east, west };
  }

  function renderTable(elementId, departures) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;

    if (departures.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="departures-empty">--</td></tr>`;
      return;
    }

    tbody.innerHTML = departures.map(dep => {
      const delay = dep.delay > 0 ? `+${dep.delay}` : '';
      const timeDisplay = dep.time.slice(0, 5);
      return `<tr>
        <td><span class="dep-line" style="background:${dep.lineColor}">${dep.line}</span></td>
        <td class="dep-direction">${dep.direction}</td>
        <td class="dep-time">${timeDisplay}</td>
        <td class="dep-delay">${delay}</td>
      </tr>`;
    }).join('');
  }

  function renderListView(container, departures) {
    if (departures.length === 0) {
      container.innerHTML = `<div class="departures-empty">--</div>`;
      return;
    }

    container.innerHTML = `<table class="departures-table"><tbody>${departures.map(dep => {
      const delay = dep.delay > 0 ? `+${dep.delay}` : '';
      const timeDisplay = dep.time.slice(0, 5);
      return `<tr>
        <td><span class="dep-line" style="background:${dep.lineColor}">${dep.line}</span></td>
        <td class="dep-direction">${dep.direction}</td>
        <td class="dep-time">${timeDisplay}</td>
        <td class="dep-delay">${delay}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
  }

  function formatTimeISO(isoString) {
    if (!isoString) return '--:--';
    const d = new Date(isoString);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  return { init, switchTo };
})();
