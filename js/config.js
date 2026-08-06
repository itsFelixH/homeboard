/**
 * Homeboard Configuration
 * Copy this file to config.local.js and fill in your values.
 * config.local.js is gitignored so your keys stay private.
 */
const HOMEBOARD_CONFIG = {
  // Location (used for weather + sunrise/sunset)
  // Find your coordinates at https://www.latlong.net/
  location: {
    latitude: 52.52,      // e.g. Berlin
    longitude: 13.41
  },

  // Weather via Open-Meteo (no API key needed!)
  weather: {
    units: 'celsius',     // 'celsius' or 'fahrenheit'
    refreshMinutes: 15
  },

  // Commute via Transitous (free, open transit routing)
  commute: {
    origin: {
      latitude: 0,        // Your home coordinates
      longitude: 0
    },
    destination: {
      latitude: 0,        // Your work coordinates
      longitude: 0
    },
    refreshMinutes: 10
  },

  // Calendar - ICS feed URL (Google Calendar, iCloud, etc.)
  calendar: {
    icsUrl: '',           // Public .ics URL
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
