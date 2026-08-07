/**
 * Homeboard - App initializer
 */
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Lang.init();

  // Translate all [data-i18n] elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = i18n(key);
    if (translated && translated !== key) {
      el.textContent = translated;
    }
  });

  // Timeout: replace any remaining "Loading..." after 15 seconds
  setTimeout(() => {
    document.querySelectorAll('.event-placeholder, .birthday-none, .countdown-empty, .departures-empty, .commute-empty').forEach(el => {
      if (el.textContent === 'Loading...') {
        el.textContent = '--';
      }
    });
  }, 15000);

  Clock.init();
  Weather.init();
  Rain.init();
  Sun.init();
  AirQuality.init();
  UV.init();
  Pollen.init();
  Calendar.init();
  Birthdays.init();
  Commute.init();
  Departures.init();
  Holiday.init();
  News.init();
  Trash.init();
  Packages.init();
  Plants.init();
  Email.init();
  History.init();
  Word.init();
  Hogwarts.init();
  Moon.init();
  GitHub.init();
  XKCD.init();
  Slideshow.init();
});
