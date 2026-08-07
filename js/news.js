/**
 * News module - headlines from Tagesschau
 * API: https://tagesschau.api.bund.dev/
 * No API key needed
 */
const News = (() => {
  let refreshInterval;
  const MAX_ITEMS = 5;

  function init() {
    fetchNews();
    refreshInterval = setInterval(fetchNews, 10 * 60 * 1000); // every 10 min
  }

  async function fetchNews() {
    const url = 'https://www.tagesschau.de/api2u/homepage';

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const articles = (data.news || [])
        .filter(item => item.type === 'story' || item.type === 'webview')
        .slice(0, MAX_ITEMS);
      render(articles);
    } catch (err) {
      console.error('News fetch failed:', err);
      document.getElementById('news-list').innerHTML =
        '<div class="news-error">Nachrichten konnten nicht geladen werden</div>';
    }
  }

  function render(articles) {
    const container = document.getElementById('news-list');

    if (articles.length === 0) {
      container.innerHTML = '<div class="news-empty">Keine Nachrichten</div>';
      return;
    }

    container.innerHTML = articles.map(article => {
      const topline = article.topline || '';
      const title = article.title || '';
      const url = article.detailsweb || article.shareURL || '#';
      const time = formatTime(article.date);
      const breaking = article.breakingNews ? '<span class="news-breaking">EILMELDUNG</span> ' : '';

      return `<a href="${url}" target="_blank" class="news-item">
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

  return { init };
})();
