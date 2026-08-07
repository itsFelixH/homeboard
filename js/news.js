/**
 * News module - headlines from Tagesschau
 * API: https://tagesschau.api.bund.dev/
 * No API key needed
 * Paginated list (5 per page), auto-cycles every 30s
 */
const News = (() => {
  let refreshInterval;
  let cycleInterval;
  let cachedArticles = [];
  let currentPage = 0;
  const PER_PAGE = 5;
  const CYCLE_SECONDS = 30;

  function init() {
    fetchNews();
    refreshInterval = setInterval(fetchNews, 10 * 60 * 1000);
    cycleInterval = setInterval(nextPage, CYCLE_SECONDS * 1000);
  }

  async function fetchNews() {
    const url = 'https://www.tagesschau.de/api2u/homepage';

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cachedArticles = (data.news || [])
        .filter(item => item.type === 'story' || item.type === 'webview');
      render();
    } catch (err) {
      console.error('News fetch failed:', err);
      document.getElementById('news-list').innerHTML =
        '<div class="news-error">Nachrichten konnten nicht geladen werden</div>';
    }
  }

  function reload() {
    document.getElementById('news-list').innerHTML = '<div class="news-empty">Loading...</div>';
    fetchNews();
  }

  function totalPages() {
    return Math.max(1, Math.ceil(cachedArticles.length / PER_PAGE));
  }

  function nextPage() {
    if (totalPages() <= 1) return;
    currentPage = (currentPage + 1) % totalPages();
    render();
  }

  function prevPage() {
    if (totalPages() <= 1) return;
    currentPage = (currentPage - 1 + totalPages()) % totalPages();
    render();
    resetCycle();
  }

  function goNext() {
    nextPage();
    resetCycle();
  }

  function resetCycle() {
    clearInterval(cycleInterval);
    cycleInterval = setInterval(nextPage, CYCLE_SECONDS * 1000);
  }

  function render() {
    // Nav in header
    let navContainer = document.querySelector('.card-news .news-nav');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.className = 'news-nav';
      const header = document.querySelector('.card-news .card-header');
      if (header) {
        const extLink = header.querySelector('.card-header-link');
        if (extLink) header.insertBefore(navContainer, extLink);
        else header.appendChild(navContainer);
      }
    }

    let navHtml = `<button class="news-reload-btn" onclick="News.reload()" title="Reload">↻</button>`;
    if (totalPages() > 1) {
      navHtml += `<div class="card-nav">
        <button class="card-nav-btn" onclick="News.prevPage()" aria-label="Previous">‹</button>
        <span class="card-nav-label">${currentPage + 1}/${totalPages()}</span>
        <button class="card-nav-btn" onclick="News.goNext()" aria-label="Next">›</button>
      </div>`;
    }
    navContainer.innerHTML = navHtml;

    // Render page
    const container = document.getElementById('news-list');
    if (cachedArticles.length === 0) {
      container.innerHTML = '<div class="news-empty">Keine Nachrichten</div>';
      return;
    }

    const start = currentPage * PER_PAGE;
    const pageArticles = cachedArticles.slice(start, start + PER_PAGE);

    container.innerHTML = pageArticles.map(article => {
      const topline = article.topline || '';
      const title = article.title || '';
      const url = article.detailsweb || article.shareURL || '#';
      const time = formatTime(article.date);
      const breaking = article.breakingNews ? '<span class="news-breaking">EILMELDUNG</span> ' : '';
      const imgUrl = article.teaserImage?.imageVariants?.['1x1-144'] || '';
      const thumb = imgUrl ? `<img class="news-thumb" src="${imgUrl}" alt="" loading="lazy">` : '';

      return `<a href="${url}" target="_blank" class="news-item">
        ${thumb}
        <div class="news-content">
          <span class="news-topline">${breaking}${topline}</span>
          <span class="news-title">${title}</span>
        </div>
        <span class="news-time">${time}</span>
      </a>`;
    }).join('');
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const now = new Date();
    const diffMin = Math.round((now - d) / 60000);
    if (diffMin < 60) return `${diffMin} min`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} h`;
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  }

  return { init, reload, prevPage, goNext };
})();
