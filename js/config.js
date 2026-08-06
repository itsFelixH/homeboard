/**
 * Homeboard Configuration
 * Copy this file to config.local.js and fill in your values.
 * config.local.js is gitignored so your keys stay private.
 */
const HOMEBOARD_CONFIG = {
  // OpenWeatherMap - get a free key at https://openweathermap.org/api
  weather: {
    apiKey: '',          // Your OWM API key
    city: '',            // e.g. 'Berlin,DE'
    units: 'metric',     // 'metric' or 'imperial'
    refreshMinutes: 15
  },

  // Commute - uses a simple time estimate or integrate with a transit API
  commute: {
    origin: '',          // e.g. 'Home address'
    destination: '',     // e.g. 'Work address'
    mode: 'transit',     // 'transit', 'driving', 'bicycling', 'walking'
    refreshMinutes: 10
  },

  // Calendar - ICS feed URL (Google Calendar, iCloud, etc.)
  calendar: {
    icsUrl: '',          // Public .ics URL
    maxEvents: 5,
    refreshMinutes: 30
  },

  // Slideshow - paths to images (relative to project root or absolute URLs)
  slideshow: {
    images: [
      // 'images/photo1.jpg',
      // 'images/photo2.jpg',
      // 'https://picsum.photos/800/400?random=1'
    ],
    intervalSeconds: 30
  }
};
