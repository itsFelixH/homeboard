/**
 * Homeboard Configuration Template
 *
 * Copy this file to config.local.js and fill in your values.
 * config.local.js is gitignored so your personal data stays private.
 *
 * Usage:
 *   cp js/config.template.js js/config.local.js
 */
const HOMEBOARD_CONFIG = {
  // Location (used for weather, sunrise/sunset, air quality, UV, pollen)
  location: {
    latitude: 0,
    longitude: 0
  },

  // Greeting (optional)
  greeting: {
    name: ''              // Your first name
  },

  // Weather via Open-Meteo (no API key needed)
  weather: {
    units: 'celsius',     // 'celsius' or 'fahrenheit'
    refreshMinutes: 15
  },

  // Commute via VBB HAFAS (transit) + OSRM (bike)
  // Shows ETA (arrival time) and route legs as compact pills
  commute: {
    origin: {
      latitude: 0,
      longitude: 0
    },
    destinations: [
      // { label: 'Office', latitude: 0, longitude: 0 },
      // { label: 'University', latitude: 0, longitude: 0 }
    ],
    refreshMinutes: 10
  },

  // Calendar - ICS feed URL (Google Calendar, iCloud, etc.)
  // For Google Calendar: Settings > Calendar > "Secret address in iCal format"
  calendar: {
    icsUrl: '',
    maxEvents: 5,
    refreshMinutes: 30,
    hidePatterns: [],     // Regex patterns to hide events, e.g. ['Arbeit', 'Meeting']
    showCommute: true     // Show bike/transit time for events with Berlin locations
  },

  // Birthdays - separate ICS calendar for birthday reminders
  // If event descriptions contain URLs (WhatsApp, Instagram, etc.), social icons are shown automatically
  // If description contains a Google Contacts URL, clicking the birthday opens the contact page
  birthdays: {
    icsUrl: '',
    refreshMinutes: 60
  },

  // Slideshow - image paths (relative or absolute URLs)
  slideshow: {
    images: [],           // Empty = random placeholders from picsum.photos
    intervalSeconds: 30
  },

  // Transit departures - multiple stops with interactive switching
  // Find your stop: https://v6.vbb.transport.rest/locations?query=YOUR+STOP
  // Product filters: suburban (S-Bahn), subway (U-Bahn), bus, tram, regional, express (ICE/IC)
  departures: {
    stopId: '',           // Legacy: single stop ID (used if stops[] is empty)
    stops: [
      // {
      //   id: '900024203',
      //   label: 'S Savignyplatz',
      //   splitView: true,                    // Two-column east/west layout
      //   splitLabels: ['Stadtmitte ←', 'Westkreuz →'],  // Direction headers
      //   splitKeywords: ['Spandau', 'Westkreuz'],       // Keywords to detect westbound
      //   products: { suburban: true }                    // Filter to S-Bahn only
      // },
      // {
      //   id: '900023201',
      //   label: 'Zoologischer Garten',
      //   splitView: true,
      //   splitLabels: ['Stadtmitte ←', 'Westkreuz →'],
      //   splitKeywords: ['Ruhleben', 'Spandau'],
      //   products: { subway: true, express: true, regional: true }
      // }
    ],
    durationMinutes: 30,
    maxResults: 5,
    refreshSeconds: 30,
    hafasAccessId: ''     // VBB HAFAS API key (optional, free at vbb.de)
  },

  // Vacation countdown (auto-detects "Urlaub" events from calendar)
  // Click the pencil icon on the dashboard to rename vacations (saved in localStorage)
  countdown: {
    date: '',             // Manual fallback: 'YYYY-MM-DD'
    label: 'Vacation',    // Fallback label
    names: {
      // Custom names by date (also editable via GUI):
      // '2026-09-17': 'Barcelona',
      // '2026-12-20': 'Weihnachten'
    }
  },

  // Trash pickup schedule
  // Berlin: download ICS from https://www.bsr.de/abfuhrkalender-20520.php
  // Place in data/ folder and reference as '/data/Abfuhrkalender.ics'
  trash: {
    icsUrl: ''            // Local path '/data/Abfuhrkalender.ics' or remote URL
  },

  // Package tracking (localStorage-based, DHL/Hermes/DPD)
  // Add packages via the form on the dashboard — they persist in localStorage
  packages: {
    dhlApiKey: '',        // Optional: DHL API key for live status
    refreshMinutes: 30
  },

  // GitHub activity feed (public events)
  github: {
    username: '',         // Your GitHub username
    refreshMinutes: 30
  }
};
