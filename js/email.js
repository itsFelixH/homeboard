/**
 * Email module - shows unread email count
 * Uses Gmail Atom feed via proxy (requires app-specific password)
 * Configure: gmail address + app password in config
 * 
 * To get an app password: Google Account > Security > 2-Step Verification > App passwords
 * The proxy fetches https://mail.google.com/mail/feed/atom with Basic Auth
 */
const Email = (() => {
  let refreshInterval;

  function init() {
    const config = HOMEBOARD_CONFIG.email;
    if (!config || !config.address) return;
    fetchCount();
    refreshInterval = setInterval(fetchCount, (config.refreshMinutes || 5) * 60 * 1000);
  }

  async function fetchCount() {
    const config = HOMEBOARD_CONFIG.email;
    const container = document.getElementById('email-content');

    try {
      // Use proxy with Basic Auth header
      const credentials = btoa(`${config.address}:${config.appPassword}`);
      const feedUrl = 'https://mail.google.com/mail/feed/atom';
      const url = `/proxy?url=${encodeURIComponent(feedUrl)}&auth=${credentials}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();

      // Parse the Atom XML for fullcount
      const match = text.match(/<fullcount>(\d+)<\/fullcount>/);
      const count = match ? parseInt(match[1]) : 0;
      render(count);
    } catch (err) {
      console.error('Email fetch failed:', err);
      // Show manual fallback or error
      container.innerHTML = `<a href="https://mail.google.com" target="_blank" class="email-link">
        <span class="email-icon">📧</span>
        <span class="email-label">Open Gmail</span>
      </a>`;
    }
  }

  function render(count) {
    const container = document.getElementById('email-content');
    const lang = Lang.get();

    const label = count === 0
      ? (lang === 'de' ? 'Keine neuen E-Mails' : 'No new emails')
      : (lang === 'de' ? `${count} ungelesen` : `${count} unread`);

    const countClass = count > 0 ? 'email-count-active' : 'email-count-zero';

    container.innerHTML = `<a href="https://mail.google.com" target="_blank" class="email-link">
      <span class="email-count ${countClass}">${count}</span>
      <span class="email-label">${label}</span>
    </a>`;
  }

  return { init };
})();
