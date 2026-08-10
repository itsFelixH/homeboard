/**
 * Package tracking module - server-state based
 * Supports DHL, Hermes, DPD with tracking links
 * Parcels are synced across devices via shared server state
 */
const Packages = (() => {
  const STATE_KEY = 'packages';

  const CARRIERS = {
    dhl: {
      name: 'DHL',
      icon: '📦',
      trackUrl: num => `https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode=${num}`
    },
    hermes: {
      name: 'Hermes',
      icon: '📬',
      trackUrl: num => `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation#${num}`
    },
    dpd: {
      name: 'DPD',
      icon: '🚛',
      trackUrl: num => `https://tracking.dpd.de/status/de_DE/parcel/${num}`
    }
  };

  async function init() {
    await render();
    // Bind add form
    document.getElementById('package-add-btn').addEventListener('click', handleAdd);
    document.getElementById('package-number-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
    });
  }

  async function getPackages() {
    const data = await State.get(STATE_KEY);
    return Array.isArray(data) ? data : [];
  }

  async function savePackages(packages) {
    await State.set(STATE_KEY, packages);
  }

  async function handleAdd() {
    const numberInput = document.getElementById('package-number-input');
    const carrierSelect = document.getElementById('package-carrier-select');
    const labelInput = document.getElementById('package-label-input');

    const trackingNumber = numberInput.value.trim();
    if (!trackingNumber) return;

    const packages = await getPackages();
    packages.push({
      id: Date.now().toString(),
      trackingNumber,
      carrier: carrierSelect.value,
      label: labelInput.value.trim() || trackingNumber.slice(0, 12),
      addedAt: new Date().toISOString()
    });

    await savePackages(packages);
    numberInput.value = '';
    labelInput.value = '';
    await render();
  }

  async function handleRemove(id) {
    const packages = (await getPackages()).filter(p => p.id !== id);
    await savePackages(packages);
    await render();
  }

  async function render() {
    const packages = await getPackages();
    const container = document.getElementById('packages-list');

    if (packages.length === 0) {
      container.innerHTML = `<div class="package-empty">${i18n('packages_empty')}</div>`;
      return;
    }

    container.innerHTML = packages.map(p => {
      const carrier = CARRIERS[p.carrier] || CARRIERS.dhl;
      const url = carrier.trackUrl(p.trackingNumber);

      return `<div class="package-item">
        <span class="package-icon">${carrier.icon}</span>
        <div class="package-info">
          <a href="${url}" target="_blank" class="package-label">${p.label}</a>
          <span class="package-status">${carrier.name} &middot; ${p.trackingNumber.slice(0, 16)}</span>
        </div>
        <button class="package-remove" onclick="Packages.remove('${p.id}')" aria-label="Remove">&times;</button>
      </div>`;
    }).join('');
  }

  async function remove(id) {
    await handleRemove(id);
  }

  return { init, remove };
})();
