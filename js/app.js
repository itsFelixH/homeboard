/**
 * Homeboard - App initializer
 */
document.addEventListener('DOMContentLoaded', () => {
  Clock.init();
  Weather.init();
  Sun.init();
  AirQuality.init();
  UV.init();
  Calendar.init();
  Commute.init();
  Facts.init();
  Slideshow.init();
});
