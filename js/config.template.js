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

  // Weather via Open-Meteo (no API key needed)
  weather: {
    units: 'celsius',     // 'celsius' or 'fahrenheit'
    refreshMinutes: 15
  },

  // Commute via VBB HAFAS (transit) + OSRM (bike)
  commute: {
    origin: {
      latitude: 0,
      longitude: 0
    },
    destinations: [
      // { label: 'Office', latitude: 0, longitude: 0 }
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
  birthdays: {
    icsUrl: '',
    refreshMinutes: 60
  },

  // Slideshow - image paths (relative or absolute URLs)
  slideshow: {
    images: [],
    intervalSeconds: 30
  },

  // S-Bahn/transit departures
  // Find your stop: https://v6.vbb.transport.rest/locations?query=YOUR+STOP
  departures: {
    stopId: '',           // Legacy: single stop ID (used if stops[] is empty)
    stops: [
      // Multiple stops with interactive switching:
      // { id: '900024203', label: 'S Savignyplatz', splitView: true, products: { filter: '1' } },
      // { id: '900023101', label: 'U Ernst-Reuter-Platz', splitView: false, products: { subway: true, bus: true } },
    ],
    durationMinutes: 30,
    maxResults: 5,
    refreshSeconds: 30,
    hafasAccessId: ''     // VBB HAFAS API key (apply at vbb.de)
  },

  // Vacation countdown (auto-detects "Urlaub" events from calendar)
  countdown: {
    date: '',             // Manual fallback: 'YYYY-MM-DD'
    label: 'Vacation',    // Fallback label
    names: {
      // Custom names by date: '2026-09-17': 'Barcelona'
    }
  },

  // BSR trash pickup schedule (Berlin)
  // Download ICS from: https://www.bsr.de/abfuhrkalender-20520.php
  trash: {
    icsUrl: ''            // Local path '/data/Abfuhrkalender.ics' or URL
  },

  // Package tracking (localStorage-based, DHL/Hermes/DPD)
  packages: {
    dhlApiKey: '',        // Optional: DHL API key for live status
    refreshMinutes: 30
  }
};
