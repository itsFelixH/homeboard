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
    rain_expected: 'erwartet, bis zu',
    rain_chance: 'Wahrscheinlichkeit',
    sunrise: 'Aufgang',
    sunset: 'Untergang',
    air_quality: 'Luftqualität',
    uv_index: 'UV-Index',
    pollen: 'Pollen',
    calendar_title: 'Heute',
    calendar_no_events: 'Keine Termine heute',
    commute: 'Pendeln',
    departures: 'S Savignyplatz',
    departures_east: 'Stadtmitte →',
    departures_west: '← Westkreuz',
    disruptions_none: 'Keine Störungen',
    countdown: 'Urlaub',
    countdown_days: 'Tage noch',
    countdown_day: 'Tag noch',
    countdown_today: 'Heute!',
    countdown_started: 'Läuft!',
    countdown_none: 'Kein Urlaub gefunden',
    trash: 'Müllabfuhr',
    packages: 'Pakete',
    packages_empty: 'Keine Pakete',
    packages_add: '+',
    packages_label_placeholder: 'Bezeichnung',
    packages_number_placeholder: 'Sendungsnummer',
    history: 'An diesem Tag',
    fact: 'Unnützes Wissen',
    news: 'Nachrichten',
    birthdays: 'Geburtstage',
    birthdays_none: 'Keine Geburtstage heute',
    birthdays_error: 'Fehler beim Laden'
  },
  en: {
    weather: 'Weather',
    rain: 'Rain',
    rain_none: 'No rain expected next 12h',
    rain_light: 'Light rain possible',
    rain_expected: 'expected, up to',
    rain_chance: 'chance',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    air_quality: 'Air Quality',
    uv_index: 'UV Index',
    pollen: 'Pollen',
    calendar_title: 'Today',
    calendar_no_events: 'No events today',
    commute: 'Commute',
    departures: 'S Savignyplatz',
    departures_east: 'City Center →',
    departures_west: '← Westkreuz',
    disruptions_none: 'No disruptions',
    countdown: 'Vacation',
    countdown_days: 'days to go',
    countdown_day: 'day to go',
    countdown_today: 'Today!',
    countdown_started: 'Started!',
    countdown_none: 'No vacation found',
    trash: 'Trash Pickup',
    packages: 'Packages',
    packages_empty: 'No packages',
    packages_add: '+',
    packages_label_placeholder: 'Label',
    packages_number_placeholder: 'Tracking number',
    history: 'On This Day',
    fact: 'Useless Fact',
    news: 'News',
    birthdays: 'Birthdays',
    birthdays_none: 'No birthdays today',
    birthdays_error: 'Error loading'
  },
  es: {
    weather: 'Clima',
    rain: 'Lluvia',
    rain_none: 'Sin lluvia en las próximas 12h',
    rain_light: 'Posible lluvia ligera',
    rain_expected: 'esperado, hasta',
    rain_chance: 'probabilidad',
    sunrise: 'Amanecer',
    sunset: 'Atardecer',
    air_quality: 'Calidad del Aire',
    uv_index: 'Índice UV',
    pollen: 'Polen',
    calendar_title: 'Hoy',
    calendar_no_events: 'Sin eventos hoy',
    commute: 'Trayecto',
    departures: 'S Savignyplatz',
    departures_east: 'Centro →',
    departures_west: '← Westkreuz',
    disruptions_none: 'Sin interrupciones',
    countdown: 'Vacaciones',
    countdown_days: 'días',
    countdown_day: 'día',
    countdown_today: '¡Hoy!',
    countdown_started: '¡Empezó!',
    countdown_none: 'Sin vacaciones',
    trash: 'Basura',
    packages: 'Paquetes',
    packages_empty: 'Sin paquetes',
    packages_add: '+',
    packages_label_placeholder: 'Etiqueta',
    packages_number_placeholder: 'Número',
    history: 'Un día como hoy',
    fact: 'Dato inútil',
    news: 'Noticias',
    birthdays: 'Cumpleaños',
    birthdays_none: 'Sin cumpleaños hoy',
    birthdays_error: 'Error'
  }
};

const Lang = (() => {
  const STORAGE_KEY = 'homeboard_lang';
  let current = 'de';

  function init() {
    current = localStorage.getItem(STORAGE_KEY) || 'de';

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
      });

      // Select language
      menu.querySelectorAll('button').forEach(item => {
        if (item.getAttribute('data-lang') === current) {
          item.classList.add('active');
        }
        item.addEventListener('click', () => {
          current = item.getAttribute('data-lang');
          localStorage.setItem(STORAGE_KEY, current);
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
  const STORAGE_KEY = 'homeboard_theme';
  let current = 'dark';

  function init() {
    current = localStorage.getItem(STORAGE_KEY) || 'dark';
    apply(current);
    const select = document.getElementById('theme-select');
    if (select) {
      select.value = current;
      select.addEventListener('change', (e) => {
        current = e.target.value;
        localStorage.setItem(STORAGE_KEY, current);
        apply(current);
      });
    }
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  return { init };
})();

function i18n(key) {
  const lang = Lang.get();
  return (I18N_STRINGS[lang] && I18N_STRINGS[lang][key]) ||
         (I18N_STRINGS.en && I18N_STRINGS.en[key]) ||
         key;
}
