/**
 * XKCD module - shows comics with navigation
 * API: https://xkcd.com/info.0.json, https://xkcd.com/{num}/info.0.json
 * Free, no key needed. Proxied for CORS.
 */
const XKCD = (() => {
  let currentNum = null;
  let latestNum = null;

  function init() {
    fetchComic(); // latest
  }

  async function fetchComic(num) {
    try {
      const apiUrl = num
        ? `https://xkcd.com/${num}/info.0.json`
        : 'https://xkcd.com/info.0.json';
      const url = `/proxy?url=${encodeURIComponent(apiUrl)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!latestNum) latestNum = data.num;
      currentNum = data.num;
      render(data);
    } catch (err) {
      console.error('XKCD fetch failed:', err);
      document.getElementById('xkcd-content').innerHTML =
        '<span class="xkcd-error">Could not load comic</span>';
    }
  }

  function prev() {
    if (currentNum && currentNum > 1) {
      fetchComic(currentNum - 1);
    }
  }

  function next() {
    if (currentNum && latestNum && currentNum < latestNum) {
      fetchComic(currentNum + 1);
    }
  }

  function random() {
    if (latestNum) {
      const num = Math.floor(Math.random() * latestNum) + 1;
      fetchComic(num);
    }
  }

  function render(comic) {
    const container = document.getElementById('xkcd-content');
    const url = `https://xkcd.com/${comic.num}/`;
    const isLatest = comic.num === latestNum;
    const isFirst = comic.num <= 1;

    container.innerHTML = `
      <a href="${url}" target="_blank" class="xkcd-link">
        <span class="xkcd-title">#${comic.num}: ${comic.title}</span>
        <img class="xkcd-img" src="${comic.img}" alt="${comic.safe_title}" title="${comic.alt}" loading="lazy">
      </a>
      <div class="xkcd-nav">
        <button class="xkcd-nav-btn" onclick="XKCD.prev()" ${isFirst ? 'disabled' : ''}>‹ Prev</button>
        <button class="xkcd-nav-btn" onclick="XKCD.random()">🎲</button>
        <button class="xkcd-nav-btn" onclick="XKCD.next()" ${isLatest ? 'disabled' : ''}>Next ›</button>
      </div>
    `;
  }

  return { init, prev, next, random };
})();
