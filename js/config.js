/**
 * Homeboard Configuration
 * Copy this file to config.local.js and fill in your values.
 * config.local.js is gitignored so your keys stay private.
 */
const HOMEBOARD_CONFIG = {
  // Location (used for weather + sunrise/sunset)
  // Find your coordinates at https://www.latlong.net/
  location: {
    latitude: 52.5075,    // Grolmanstr. 55, 10623 Berlin
    longitude: 13.3220
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
  },

  // S-Bahn departures via VBB transport.rest (free, no key, CORS)
  departures: {
    stopId: '900024203',  // S Savignyplatz (Berlin)
    durationMinutes: 30,  // How far ahead to look
    maxResults: 8,        // Max departures to show
    refreshSeconds: 30    // Update every 30s for realtime
  },

  // Countdown to next vacation or event
  countdown: {
    date: '',             // e.g. '2026-12-20' (YYYY-MM-DD)
    label: 'Vacation'     // What to display
  }
};
