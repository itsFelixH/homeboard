/**
 * Plant watering tracker - localStorage-based
 * Track when you last watered each plant, shows days since
 */
const Plants = (() => {
  const STORAGE_KEY = 'homeboard_plants';

  function init() {
    render();
  }

  function getPlants() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function savePlants(plants) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
  }

  function water(id) {
    const plants = getPlants();
    const plant = plants.find(p => p.id === id);
    if (plant) {
      plant.lastWatered = new Date().toISOString();
      savePlants(plants);
      render();
    }
  }

  function addPlant(name, intervalDays) {
    const plants = getPlants();
    plants.push({
      id: Date.now().toString(),
      name: name.trim(),
      intervalDays: intervalDays || 7,
      lastWatered: new Date().toISOString()
    });
    savePlants(plants);
    render();
  }

  function removePlant(id) {
    const plants = getPlants().filter(p => p.id !== id);
    savePlants(plants);
    render();
  }

  function render() {
    const plants = getPlants();
    const container = document.getElementById('plants-list');
    const lang = Lang.get();

    if (plants.length === 0) {
      const emptyText = lang === 'de' ? 'Keine Pflanzen' : lang === 'es' ? 'Sin plantas' : 'No plants';
      container.innerHTML = `<div class="plants-empty">${emptyText}</div>`;
      return;
    }

    const now = new Date();
    container.innerHTML = plants.map(p => {
      const last = new Date(p.lastWatered);
      const daysSince = Math.floor((now - last) / (1000 * 60 * 60 * 24));
      const overdue = daysSince >= p.intervalDays;
      const statusClass = overdue ? 'plants-overdue' : daysSince >= p.intervalDays - 1 ? 'plants-soon' : 'plants-ok';

      let daysText;
      if (daysSince === 0) daysText = lang === 'de' ? 'heute' : 'today';
      else if (daysSince === 1) daysText = lang === 'de' ? 'gestern' : 'yesterday';
      else daysText = lang === 'de' ? `vor ${daysSince} T.` : `${daysSince}d ago`;

      return `<div class="plants-item ${statusClass}">
        <button class="plants-water-btn" onclick="Plants.water('${p.id}')" title="Mark as watered">💧</button>
        <span class="plants-name">${p.name}</span>
        <span class="plants-days">${daysText}</span>
        <button class="plants-remove" onclick="Plants.remove('${p.id}')" aria-label="Remove">&times;</button>
      </div>`;
    }).join('');
  }

  function remove(id) {
    removePlant(id);
  }

  return { init, water, addPlant, remove };
})();
