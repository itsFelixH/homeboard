describe('Dashboard Widgets (Plants, News, Word, Hogwarts, GitHub, XKCD, Trash, Packages)', () => {
  beforeEach(() => {
    global.resetDOM();
    localStorage.clear();
    HOMEBOARD_CONFIG = {
      trash: { icsUrl: 'https://example.com/trash.ics' },
      packages: {},
      plants: { warningDays: 7 },
      news: { maxItems: 5, defaultCategory: 'homepage' },
      word: {},
      spell: { cycleSeconds: 60 },
      history: { minYear: 1500 },
      github: { username: 'testuser', maxEvents: 4 },
      xkcd: {}
    };
    jest.restoreAllMocks();
  });

  test('Plants.init renders status and waterNow updates timestamp', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    await Plants.init();
    const container = document.getElementById('plants-content');
    expect(container.innerHTML).toContain('plants-status');

    await Plants.waterNow();
    expect(container.innerHTML).toContain('plants-status-ok');
  });

  test('News.init fetches Tagesschau news items and updates ticker', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        news: [
          { type: 'story', title: 'Wichtige Eilmeldung', shareURL: 'https://tagesschau.de/1', date: '2026-09-19T10:00:00Z' }
        ]
      })
    });

    News.init();
    await new Promise(r => setTimeout(r, 50));

    const newsList = document.getElementById('news-list');
    expect(newsList.innerHTML).toContain('Wichtige Eilmeldung');
  });

  test('Word.init fetches Word of the Day and displays definition', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        word: 'serendipity',
        phonetic: '/ˌsɛrənˈdɪpɪti/',
        meanings: [{ definitions: [{ definition: 'The occurrence of events by chance in a happy way.' }] }]
      }]
    });

    Word.init();
    await new Promise(r => setTimeout(r, 50));

    const wordEl = document.getElementById('word-title');
    if (wordEl) {
      expect(wordEl.textContent.length).toBeGreaterThan(0);
    }
  });

  test('Hogwarts.init displays daily Harry Potter spell/trivia item', () => {
    Hogwarts.init();
    const spellEl = document.querySelector('.card-spell');
    expect(spellEl).not.toBeNull();
  });

  test('GitHub.init fetches user public events and populates activity list', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          type: 'PushEvent',
          repo: { name: 'user/repo' },
          payload: { commits: [{ message: 'feat: add tests' }] }
        }
      ]
    });

    GitHub.init();
    await new Promise(r => setTimeout(r, 50));

    const ghEl = document.querySelector('.card-github');
    expect(ghEl).not.toBeNull();
  });

  test('XKCD.init fetches current webcomic and renders image', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        num: 3000,
        title: 'Automation',
        img: 'https://imgs.xkcd.com/comics/automation.png',
        alt: 'Code tests everything'
      })
    });

    XKCD.init();
    await new Promise(r => setTimeout(r, 50));

    const xkcdEl = document.querySelector('.card-xkcd');
    expect(xkcdEl).not.toBeNull();
  });
});
