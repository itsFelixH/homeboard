/**
 * XKCD module - shows today's (latest) comic
 * API: https://xkcd.com/info.0.json
 * Free, no key needed, no CORS issues
 */
const XKCD = (() => {
  function init() {
    fetchComic();
  }

  async function fetchComic() {
    try {
      const res = await fetch('https://xkcd.com/info.0.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      console.error('XKCD fetch failed:', err);
      document.getElementById('xkcd-content').innerHTML =
        '<span class="xkcd-error">Could not load comic</span>';
    }
  }

  function render(comic) {
    const container = document.getElementById('xkcd-content');
    const url = `https://xkcd.com/${comic.num}/`;

    container.innerHTML = `
      <a href="${url}" target="_blank" class="xkcd-link">
        <span class="xkcd-title">#${comic.num}: ${comic.title}</span>
        <img class="xkcd-img" src="${comic.img}" alt="${comic.safe_title}" title="${comic.alt}" loading="lazy">
      </a>
    `;
  }

  return { init };
})();
