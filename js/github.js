/**
 * GitHub activity module - shows recent public activity
 * API: https://api.github.com/users/{username}/events/public
 * Free, no key needed (60 req/hour unauthenticated)
 */
const GitHub = (() => {
  let refreshInterval;
  const MAX_EVENTS = 4;

  const EVENT_ICONS = {
    PushEvent: '📝',
    CreateEvent: '🌱',
    DeleteEvent: '🗑️',
    PullRequestEvent: '🔀',
    IssuesEvent: '🎫',
    IssueCommentEvent: '💬',
    WatchEvent: '⭐',
    ForkEvent: '🍴',
    ReleaseEvent: '🚀',
    PublicEvent: '🌐'
  };

  function init() {
    const config = HOMEBOARD_CONFIG.github;
    if (!config || !config.username) return;
    // Set profile link in header
    const profileLink = document.getElementById('github-profile-link');
    if (profileLink) profileLink.href = `https://github.com/${config.username}`;
    fetchActivity();
    refreshInterval = setInterval(fetchActivity, (config.refreshMinutes || 30) * 60 * 1000);
  }

  async function fetchActivity() {
    const config = HOMEBOARD_CONFIG.github;
    const url = `https://api.github.com/users/${config.username}/events/public?per_page=10`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const events = await res.json();
      render(events);
    } catch (err) {
      console.error('GitHub fetch failed:', err);
      document.getElementById('github-list').innerHTML =
        '<div class="github-empty">Could not load activity</div>';
    }
  }

  function render(events) {
    const container = document.getElementById('github-list');

    if (!events || events.length === 0) {
      container.innerHTML = '<div class="github-empty">No recent activity</div>';
      return;
    }

    // Dedupe and limit
    const shown = [];
    const seen = new Set();
    for (const e of events) {
      const key = `${e.type}-${e.repo.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      shown.push(e);
      if (shown.length >= MAX_EVENTS) break;
    }

    container.innerHTML = shown.map(e => {
      const icon = EVENT_ICONS[e.type] || '📌';
      const repo = e.repo.name.split('/').pop();
      const repoFull = e.repo.name;
      const desc = getDescription(e);
      const time = formatRelative(e.created_at);
      const url = `https://github.com/${repoFull}`;

      return `<a href="${url}" target="_blank" class="github-item">
        <span class="github-icon">${icon}</span>
        <div class="github-info">
          <span class="github-repo">${repo}</span>
          <span class="github-desc">${desc}</span>
        </div>
        <span class="github-time">${time}</span>
      </a>`;
    }).join('');
  }

  function getDescription(event) {
    switch (event.type) {
      case 'PushEvent': {
        const commits = event.payload.commits || [];
        if (commits.length === 0) return 'pushed';
        const msg = commits[commits.length - 1].message.split('\n')[0];
        return msg.length > 50 ? msg.slice(0, 50) + '…' : msg;
      }
      case 'CreateEvent': return `created ${event.payload.ref_type} ${event.payload.ref || ''}`.trim();
      case 'DeleteEvent': return `deleted ${event.payload.ref_type} ${event.payload.ref || ''}`.trim();
      case 'PullRequestEvent': return `${event.payload.action} PR #${event.payload.number || ''}`;
      case 'IssuesEvent': return `${event.payload.action} issue`;
      case 'IssueCommentEvent': return 'commented';
      case 'WatchEvent': return 'starred';
      case 'ForkEvent': return 'forked';
      case 'ReleaseEvent': return `released ${event.payload.release?.tag_name || ''}`;
      default: return event.type.replace('Event', '').toLowerCase();
    }
  }

  function formatRelative(isoStr) {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMin = Math.round((now - d) / 60000);
    if (diffMin < 60) return `${diffMin}m`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
    const days = Math.floor(diffMin / 1440);
    return `${days}d`;
  }

  return { init };
})();
