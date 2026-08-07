# Homeboard

A clean, self-hosted apartment dashboard for a wall-mounted tablet or always-on screen. Built with vanilla HTML/CSS/JS — no frameworks, no build tools, no dependencies.

![Dark theme](https://img.shields.io/badge/theme-dark-0f0f17) ![Light theme](https://img.shields.io/badge/theme-light-f8fafc) ![Pixel theme](https://img.shields.io/badge/theme-pixel-ff4488)

## What It Shows

- **Weather** — current conditions + 4-day forecast (Open-Meteo)
- **Rain** — 12-hour precipitation bar chart with probability
- **Air Quality** — European AQI with PM2.5/PM10
- **UV Index** — color-coded current level
- **Pollen** — grass, birch, alder, mugwort, ragweed, olive
- **S-Bahn Departures** — real-time timetable split by direction
- **Commute** — transit + bike time to multiple destinations
- **Calendar** — today's events from any ICS feed
- **Birthdays** — upcoming birthdays from a dedicated ICS calendar
- **Vacation Countdown** — auto-detects "Urlaub" events from calendar
- **Trash Pickup** — next collection dates from BSR ICS
- **Package Tracking** — DHL/Hermes/DPD with localStorage persistence
- **Berlin Events** — quick links to what's on today
- **Useless Fact** — daily conversation starter
- **On This Day** — historical event from Wikipedia
- **Moon Phase** — calculated, no API needed
- **Slideshow** — rotating photo display

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USER/homeboard.git
cd homeboard
cp js/config.template.js js/config.local.js
```

Edit `js/config.local.js` with your coordinates, calendar URL, stop ID, etc. The file is gitignored so your personal data stays private.

### 2. Run locally

```bash
python3 server.py
```

Open http://localhost:7070

The Python server handles static files plus a `/proxy` endpoint for CORS-restricted feeds (Google Calendar, VBB HAFAS).

### 3. Run with Docker (recommended for always-on)

```bash
docker compose up -d
```

This builds an nginx image and serves the dashboard on port 7070. Your `config.local.js` and `data/` folder are mounted as volumes.

## Configuration

All settings live in `js/config.local.js`. See `js/config.template.js` for all available options with comments.

| Section | What to fill in |
|---------|----------------|
| `location` | Your latitude/longitude (used for weather, UV, pollen, air quality) |
| `calendar.icsUrl` | Your Google Calendar "Secret address in iCal format" |
| `birthdays.icsUrl` | Separate calendar for birthdays |
| `departures.stopId` | Your nearest transit stop ([find it here](https://v6.vbb.transport.rest/locations?query=YOUR+STOP)) |
| `departures.hafasAccessId` | VBB HAFAS API key (optional, free at vbb.de) |
| `commute.destinations` | Work/school locations with lat/lng |
| `trash.icsUrl` | BSR calendar ICS ([download here](https://www.bsr.de/abfuhrkalender-20520.php)) or any trash schedule ICS |
| `countdown.names` | Custom labels for vacation dates |
| `slideshow.images` | Array of image URLs or paths |

### Getting your Google Calendar ICS URL

1. Go to [Google Calendar Settings](https://calendar.google.com/calendar/r/settings)
2. Click on your calendar
3. Scroll to "Secret address in iCal format"
4. Copy the URL

## Adapting for Your City

Homeboard is designed for Berlin but works anywhere:

- **Weather, rain, UV, AQI, pollen** — just change `location.latitude/longitude`
- **Transit departures** — works with any VBB stop (Berlin/Brandenburg). For other cities, swap `departures.js` with your local transit API
- **Commute** — uses OSRM (global) for bike and Transitous/HAFAS for transit
- **Trash** — any ICS calendar works, not just BSR
- **Calendar/Birthdays** — any standard ICS feed (Google, Apple, Outlook, Nextcloud)

## APIs Used

All APIs are free and require no registration unless noted.

| Feature | API | Key needed? |
|---------|-----|-------------|
| Weather + Rain + Sunrise | [Open-Meteo](https://open-meteo.com/) | No |
| Air Quality + Pollen | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | No |
| UV Index | [currentuvindex.com](https://currentuvindex.com/api) | No |
| Transit departures | [VBB HAFAS](https://vbb.demo.hafas.cloud/) | Optional |
| Transit routing | [Transitous](https://transitous.org/) | No |
| Bike routing | [OSRM](https://project-osrm.org/) | No |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org/) | No |
| On This Day | [Wikipedia](https://api.wikimedia.org/) | No |
| Useless Fact | [uselessfacts.jsph.pl](https://uselessfacts.jsph.pl/) | No |

## Themes

Switch between themes using the dropdown in the top-right corner. Preference is saved in localStorage.

- **Dark** — default, low-light optimized for always-on displays
- **Light** — bright mode for well-lit rooms
- **Pixel** — retro 8-bit aesthetic with Press Start 2P font

## Languages

German (default), English, and Spanish. Switch via the flag dropdown. Add more in `js/i18n.js`.

## PWA Support

The dashboard includes a `manifest.json` for "Add to Home Screen":

- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome will prompt automatically

## Project Structure

```
homeboard/
├── index.html              # Single page with all widget sections
├── css/style.css           # Themes, grid layout, responsive breakpoints
├── js/
│   ├── config.template.js  # Configuration template (committed)
│   ├── config.local.js     # Your config (gitignored)
│   ├── app.js              # Module initializer
│   ├── i18n.js             # Translations, theme switcher, lang switcher
│   ├── clock.js            # Time & date
│   ├── weather.js          # Current + 5-day forecast
│   ├── rain.js             # 12h precipitation chart
│   ├── sun.js              # Sunrise & sunset
│   ├── airquality.js       # European AQI
│   ├── uv.js               # UV index
│   ├── pollen.js           # Pollen levels
│   ├── departures.js       # Transit departures (VBB HAFAS)
│   ├── commute.js          # Transit + bike routing
│   ├── calendar.js         # ICS parser with RRULE support
│   ├── birthdays.js        # Birthday countdown
│   ├── countdown.js        # Vacation countdown
│   ├── trash.js            # Trash pickup schedule
│   ├── packages.js         # Package tracking (localStorage)
│   ├── events.js           # Berlin event links
│   ├── history.js          # On This Day (Wikipedia)
│   ├── facts.js            # Daily useless fact
│   ├── moon.js             # Moon phase calculation
│   ├── slideshow.js        # Image carousel
│   └── disruptions.js      # Service alerts (disabled)
├── server.py               # Dev server with CORS proxy
├── data/                   # Local ICS files (gitignored)
├── Dockerfile              # nginx production image
├── docker-compose.yml      # One-command deployment
├── nginx.conf              # nginx config for Docker
├── manifest.json           # PWA manifest
└── favicon.svg             # Dashboard icon
```

## Hardware Suggestions

This runs well on:
- Raspberry Pi 4 + any screen (Chromium in kiosk mode)
- Old tablet mounted on the wall (Android + Fully Kiosk Browser)
- Any always-on laptop/mini-PC with a monitor

For Raspberry Pi kiosk mode:
```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:7070
```

## Contributing

PRs welcome. Keep it simple — no build tools, no frameworks. Each widget should be a self-contained IIFE module.

## License

MIT
