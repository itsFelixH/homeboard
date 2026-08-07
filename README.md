# Homeboard

A clean, self-hosted apartment dashboard for a wall-mounted tablet or always-on screen. Built with vanilla HTML/CSS/JS — no frameworks, no build tools, no dependencies.

![Dark theme](https://img.shields.io/badge/theme-dark-0f0f17) ![Light theme](https://img.shields.io/badge/theme-light-f8fafc) ![Pixel theme](https://img.shields.io/badge/theme-pixel-ff4488)

## What It Shows

- **Weather** — current conditions + 4-day forecast, fully translated (DE/EN/ES)
- **Rain** — 12-hour precipitation bar chart with probability
- **S-Bahn/U-Bahn Departures** — real-time timetable, multiple stops with interactive switching
- **Commute** — ETA-focused chips with transit + bike time, route legs as pills
- **Air Quality** — European AQI with PM2.5/PM10
- **UV Index** — color-coded current level
- **Pollen** — grass, birch, alder, mugwort, ragweed, olive
- **Calendar** — today's events from any ICS feed, with commute times for Berlin locations
- **Birthdays** — upcoming birthdays with social links (WhatsApp, Instagram, Telegram, Signal, LinkedIn)
- **Vacation Countdown** — auto-detects "Urlaub" events, click-to-rename, links to Google Calendar
- **News** — Tagesschau headlines with thumbnails
- **Word of the Day** — English vocabulary with definition and phonetics
- **The Daily Prophet** — rotating Harry Potter content (spells, characters, houses, books, trivia)
- **On This Day** — historical event from Wikipedia, clickable to full article
- **Trash Pickup** — next collection dates from BSR ICS
- **Package Tracking** — DHL/Hermes/DPD with localStorage persistence
- **Moon Phase** — calculated, no API needed
- **Slideshow** — rotating photo display

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USER/homeboard.git
cd homeboard
cp js/config.template.js js/config.local.js
```

Edit `js/config.local.js` with your coordinates, calendar URL, transit stops, etc. The file is gitignored so your personal data stays private.

### 2. Run locally

```bash
python3 server.py
```

Open http://localhost:7070

The Python server handles static files plus a `/proxy` endpoint for CORS-restricted feeds (Google Calendar, VBB HAFAS, Nominatim).

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
| `birthdays.icsUrl` | Separate calendar for birthdays (supports social links in description) |
| `departures.stops` | Array of transit stops with product filters and split-view config |
| `departures.hafasAccessId` | VBB HAFAS API key (optional, free at vbb.de) |
| `commute.destinations` | Work/school locations with lat/lng |
| `trash.icsUrl` | BSR calendar ICS ([download here](https://www.bsr.de/abfuhrkalender-20520.php)) or any trash schedule ICS |
| `countdown.names` | Custom labels for vacation dates (or rename via GUI) |
| `slideshow.images` | Array of image URLs or paths |

### Multi-stop departures

The departures card supports multiple stops with interactive switching:

```javascript
departures: {
  stops: [
    {
      id: '900024203',
      label: 'S Savignyplatz',
      splitView: true,
      splitLabels: ['Stadtmitte ←', 'Westkreuz →'],
      splitKeywords: ['Spandau', 'Westkreuz', 'Wannsee'],
      products: { suburban: true }
    },
    {
      id: '900023101',
      label: 'U Ernst-Reuter-Platz',
      splitView: true,
      splitLabels: ['Uhlandstr. ←', 'Ruhleben →'],
      splitKeywords: ['Ruhleben'],
      products: { subway: true }
    }
  ]
}
```

Product filters: `suburban` (S-Bahn), `subway` (U-Bahn), `bus`, `tram`, `regional`, `express` (ICE/IC).

### Birthday social links

If your birthday calendar events have URLs in the description (WhatsApp, Instagram, etc.), they'll automatically appear as clickable icons:

```
WhatsApp: https://wa.me/491234567890
Instagram: https://www.instagram.com/username/
Kontakt: https://contacts.google.com/person/c1234567890
```

### Getting your Google Calendar ICS URL

1. Go to [Google Calendar Settings](https://calendar.google.com/calendar/r/settings)
2. Click on your calendar
3. Scroll to "Secret address in iCal format"
4. Copy the URL

## Interactive Features

- **Departures** — click arrows to switch between stops (S-Bahn, U-Bahn, Bus)
- **Commute** — click arrows to switch between destinations, shows live ETA
- **Vacation** — click entry to open week in Google Calendar, click pencil to rename
- **Birthdays** — click name to open Google Contacts, click social icons for WhatsApp/Instagram
- **News** — click headline to read full article on Tagesschau
- **On This Day** — click to read Wikipedia article
- **Packages** — click to open carrier tracking page
- **All cards** — external link icon in header opens relevant detail page

## Adapting for Your City

Homeboard is designed for Berlin but works anywhere:

- **Weather, rain, UV, AQI, pollen** — just change `location.latitude/longitude`
- **Transit departures** — works with any VBB stop (Berlin/Brandenburg). For other cities, swap `departures.js` with your local transit API
- **Commute** — uses OSRM (global) for bike and Transitous/HAFAS for transit
- **Trash** — any ICS calendar works, not just BSR
- **Calendar/Birthdays** — any standard ICS feed (Google, Apple, Outlook, Nextcloud)
- **News** — Tagesschau (German), swap the API URL for your preferred news source

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
| News | [Tagesschau API](https://tagesschau.api.bund.dev/) | No |
| On This Day | [Wikipedia](https://api.wikimedia.org/) | No |
| Word of the Day | [Free Dictionary API](https://dictionaryapi.dev/) | No |
| Harry Potter | [HP API](https://hp-api.onrender.com/) + [PotterAPI](https://potterapi-fedeperin.vercel.app/) | No |

## Themes

Switch between themes using the dropdown in the top-right corner. Preference is saved in localStorage.

- **Dark** — default, low-light optimized for always-on displays
- **Light** — bright mode for well-lit rooms
- **Pixel** — retro 8-bit aesthetic with Press Start 2P font

## Languages

German (default), English, and Spanish. Switch via the flag dropdown. All widget content is translated including weather descriptions, day names, and UI labels.

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
│   ├── i18n.js             # Translations (DE/EN/ES), theme, language switcher
│   ├── clock.js            # Time & date
│   ├── weather.js          # Current + forecast (translated)
│   ├── rain.js             # 12h precipitation chart
│   ├── sun.js              # Sunrise & sunset
│   ├── airquality.js       # European AQI
│   ├── uv.js               # UV index
│   ├── pollen.js           # Pollen levels
│   ├── departures.js       # Multi-stop departures (interactive)
│   ├── commute.js          # ETA chips + route pills (interactive)
│   ├── calendar.js         # ICS parser with RRULE + commute
│   ├── birthdays.js        # Birthday countdown + social links
│   ├── holiday.js          # Vacation countdown (click-to-rename)
│   ├── news.js             # Tagesschau headlines + thumbnails
│   ├── word.js             # Word of the Day
│   ├── harrypotter.js      # The Daily Prophet (rotating HP content)
│   ├── history.js          # On This Day (Wikipedia)
│   ├── trash.js            # Trash pickup schedule
│   ├── packages.js         # Package tracking (localStorage)
│   ├── moon.js             # Moon phase calculation
│   └── slideshow.js        # Image carousel
├── server.py               # Dev server with CORS proxy
├── data/                   # Local ICS files (gitignored)
├── Dockerfile              # nginx production image
├── docker-compose.yml      # One-command deployment
├── nginx.conf              # nginx config for Docker
├── manifest.json           # PWA manifest
└── favicon.svg             # Dashboard grid icon
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

PRs welcome. Keep it simple — no build tools, no frameworks. Each widget should be a self-contained IIFE module. All user-facing text must be translated (DE/EN/ES).

## License

MIT
