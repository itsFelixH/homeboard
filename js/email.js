/**
 * Email module - Gmail unread count via OAuth2
 * Uses server-side /api/gmail/unread endpoint (OAuth2 token managed by server)
 * First-time setup: click "Connect Gmail" to authorize via Google
 */
const Email = (() => {
  let refreshInterval;

  async function init() {
    const config = HOMEBOARD_CONFIG.email;
    if (!config || !config.clientId) return;

    // Check if Gmail is connected
    const connected = await checkStatus();
    if (connected) {
      fetchCount();
      refreshInterval = setInterval(fetchCount, (config.refreshMinutes || 5) * 60 * 1000);
    } else {
      showConnectButton();
    }
  }

  async function checkStatus() {
    try {
      const res = await fetch('/api/gmail/status');
      if (!res.ok) return false;
      const data = await res.json();
      return data.connected === true;
    } catch (e) {
      return false;
    }
  }

  function showConnectButton() {
    const container = document.getElementById('email-content');
    container.innerHTML = `<a href="/auth/gmail" class="email-link email-connect">
      <span class="email-icon">🔗</span>
      <span class="email-label">Connect Gmail</span>
    </a>`;
  }

  async function fetchCount() {
    const container = document.getElementById('email-content');

    try {
      const res = await fetch('/api/gmail/unread');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.error === 'not_connected' || data.error === 'token_expired') {
        showConnectButton();
        return;
      }

      render(data.count || 0);
    } catch (err) {
      console.error('Email fetch failed:', err);
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
