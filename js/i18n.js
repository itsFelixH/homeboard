/**
 * Internationalization + Theme system
 * Languages: de (German, default), en (English), es (Spanish)
 * Themes: dark (default), light, pixel
 */
const I18N_STRINGS = {
  de: {
    weather: 'Wetter',
    rain: 'Regen',
    rain_none: 'Kein Regen in den nächsten 12h',
    rain_light: 'Leichter Regen möglich',
    air_quality: 'Luftqualität',
    uv_index: 'UV-Index',
    pollen: 'Pollen',
    calendar_title: 'Heute',
    calendar_no_events: 'Keine Termine heute',
    commute: 'Pendeln',
    departures: 'S Savignyplatz',
    countdown: 'Urlaub',
    countdown_today: 'Heute!',
    countdown_started: 'Läuft!',
    countdown_none: 'Kein Urlaub gefunden',
    trash: 'Müllabfuhr',
    packages: 'Pakete',
    packages_empty: 'Keine Pakete',
    history: 'An diesem Tag',
    news: 'Nachrichten',
    word: 'Wort des Tages',
    spell: 'The Daily Prophet',
    birthdays: 'Geburtstage',
    birthdays_none: 'Keine Geburtstage heute',
    birthdays_error: 'Fehler beim Laden',
    plants: 'Pflanzen',
    email: 'E-Mail',
    github: 'GitHub',
    home: 'Zuhause'
  },
  en: {
    weather: 'Weather',
    rain: 'Rain',
    rain_none: 'No rain expected next 12h',
    rain_light: 'Light rain possible',
    air_quality: 'Air Quality',
    uv_index: 'UV Index',
    pollen: 'Pollen',
    calendar_title: 'Today',
    calendar_no_events: 'No events today',
    commute: 'Commute',
    departures: 'S Savignyplatz',
    countdown: 'Vacation',
    countdown_today: 'Today!',
    countdown_started: 'Started!',
    countdown_none: 'No vacation found',
    trash: 'Trash Pickup',
    packages: 'Packages',
    packages_empty: 'No packages',
    history: 'On This Day',
    news: 'News',
    word: 'Word of the Day',
    spell: 'The Daily Prophet',
    birthdays: 'Birthdays',
    birthdays_none: 'No birthdays today',
    birthdays_error: 'Error loading',
    plants: 'Plants',
    email: 'Email',
    github: 'GitHub',
    home: 'Home'
  },
  es: {
    weather: 'Clima',
    rain: 'Lluvia',
    rain_none: 'Sin lluvia en las próximas 12h',
    rain_light: 'Posible lluvia ligera',
    air_quality: 'Calidad del Aire',
    uv_index: 'Índice UV',
    pollen: 'Polen',
    calendar_title: 'Hoy',
    calendar_no_events: 'Sin eventos hoy',
    commute: 'Trayecto',
    departures: 'S Savignyplatz',
    countdown: 'Vacaciones',
    countdown_today: '¡Hoy!',
    countdown_started: '¡Empezó!',
    countdown_none: 'Sin vacaciones',
    trash: 'Basura',
    packages: 'Paquetes',
    packages_empty: 'Sin paquetes',
    history: 'Un día como hoy',
    news: 'Noticias',
    word: 'Palabra del día',
    spell: 'The Daily Prophet',
    birthdays: 'Cumpleaños',
    birthdays_none: 'Sin cumpleaños hoy',
    birthdays_error: 'Error',
    plants: 'Plantas',
    email: 'Correo',
    github: 'GitHub',
    home: 'Casa'
  }
};

const Lang = (() => {
  const STATE_KEY = 'lang';
  let current = 'de';

  function init() {
    // Use localStorage for instant first render, sync from server state in background
    current = localStorage.getItem('homeboard_lang') || 'de';
    State.get(STATE_KEY).then(val => {
      if (val && val !== current) {
        current = val;
        localStorage.setItem('homeboard_lang', val);
        location.reload();
      }
    });

    // Custom dropdown
    const btn = document.getElementById('lang-btn');
    const menu = document.getElementById('lang-menu');
    const preview = document.getElementById('lang-flag-preview');

    if (btn && menu) {
      // Set preview to current flag
      const activeItem = menu.querySelector(`[data-lang="${current}"]`);
      if (activeItem && preview) {
        preview.innerHTML = activeItem.querySelector('svg').outerHTML;
      }

      // Toggle menu
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
        // Close theme menu if open
        const themeMenu = document.getElementById('theme-menu');
        if (themeMenu) themeMenu.classList.remove('open');
      });

      // Select language
      menu.querySelectorAll('button').forEach(item => {
        if (item.getAttribute('data-lang') === current) {
          item.classList.add('active');
        }
        item.addEventListener('click', () => {
          current = item.getAttribute('data-lang');
          localStorage.setItem('homeboard_lang', current);
          State.set(STATE_KEY, current);
          location.reload();
        });
      });

      // Close on outside click
      document.addEventListener('click', () => menu.classList.remove('open'));
    }
  }

  function get() {
    return current;
  }

  return { init, get };
})();

const Theme = (() => {
  const STATE_KEY = 'theme';

  function init() {
    // Get saved theme preference
    const saved = localStorage.getItem('homeboard_theme') || 'dark';

    // Apply immediately from loaded themes
    Themes.onReady(() => {
      Themes.apply(saved);
      buildMenu();

      // Sync from server state in background
      State.get(STATE_KEY).then(val => {
        if (val && val !== saved) {
          localStorage.setItem('homeboard_theme', val);
          Themes.apply(val);
          buildMenu();
        }
      });
    });
  }

  function buildMenu() {
    const btn = document.getElementById('theme-btn');
    const menu = document.getElementById('theme-menu');
    const preview = document.getElementById('theme-preview');
    if (!btn || !menu) return;

    const themes = Themes.all();
    const current = Themes.current();

    // Build menu items dynamically
    menu.innerHTML = Object.entries(themes).map(([id, theme]) => {
      const active = id === current ? ' class="active"' : '';
      return `<button data-value="${id}"${active}><span class="menu-icon">${theme.icon}</span> ${theme.name}</button>`;
    }).join('');

    // Set preview icon
    if (preview) {
      const currentTheme = themes[current];
      preview.textContent = currentTheme ? currentTheme.icon : '🎨';
    }

    // Toggle menu
    btn.onclick = (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
      const langMenu = document.getElementById('lang-menu');
      if (langMenu) langMenu.classList.remove('open');
    };

    // Select theme
    menu.querySelectorAll('button').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-value');
        localStorage.setItem('homeboard_theme', id);
        State.set(STATE_KEY, id);
        Themes.apply(id);
        buildMenu();
        menu.classList.remove('open');
      });
    });

    // Close on outside click
    document.addEventListener('click', () => menu.classList.remove('open'));
  }

  return { init };
})();

function i18n(key) {
  const lang = Lang.get();
  return (I18N_STRINGS[lang] && I18N_STRINGS[lang][key]) ||
         (I18N_STRINGS.en && I18N_STRINGS.en[key]) ||
         key;
}
