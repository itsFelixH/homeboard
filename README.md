# Homeboard

A clean, self-hosted apartment dashboard for a wall-mounted tablet or always-on screen. Built with vanilla HTML/CSS/JS — no frameworks, no build tools, no dependencies.

![Dark theme](https://img.shields.io/badge/theme-dark-0f0f17) ![Light theme](https://img.shields.io/badge/theme-light-f8fafc) ![Pixel theme](https://img.shields.io/badge/theme-pixel-ff4488)

## What It Shows

- **Weather** — current conditions + forecast, clothing suggestion, fully translated (DE/EN/ES)
- **Rain** — hourly precipitation bar chart with probability
- **S-Bahn/U-Bahn Departures** — real-time timetable, multiple stops with interactive switching
- **Commute** — ETA with transit + bike time, route legs as pills
- **Air Quality** — European AQI with PM2.5/PM10
- **UV Index** — color-coded current level
- **Pollen** — grass, birch, alder, mugwort, ragweed, olive
- **Calendar** — today's events from any ICS feed, with commute times for locations
- **Birthdays** — upcoming birthdays with social links (WhatsApp, Instagram, Telegram, Signal, LinkedIn)
- **Vacation Countdown** — auto-detects vacation events, click-to-rename, links to Google Calendar
- **News** — Tagesschau headlines with thumbnails, category filters
- **Word of the Day** — English vocabulary with definition and phonetics
- **The Daily Prophet** — rotating Harry Potter content (spells, characters, houses, books, trivia, quiz)
- **On This Day** — historical event from Wikipedia, clickable to full article
- **Trash Pickup** — next collection dates from ICS calendar
- **GitHub** — recent public activity feed
- **XKCD** — latest comic with navigation
- **Package Tracking** — DHL/Hermes/DPD with localStorage persistence
- **Email** — Gmail unread count
- **Plants** — watering tracker with reminder
- **Moon Phase** — calculated, no API needed
- **Slideshow** — rotating photo display

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USER/homeboard.git
cd homeboard
cp config.template.yaml config.local.yaml
```

Edit `config.local.yaml` with your coordinates, calendar URL, transit stops, etc. The file is gitignored so your personal data stays private.

### 2. Run with Docker (recommended)

```bash
docker compose up -d
```

Open http://localhost:7070

### 3. Run locally (without Docker)

```bash
python3 server.py
```

Open http://localhost:7070

The Python server handles static files plus a `/proxy` endpoint for CORS-restricted feeds (Google Calendar, VBB HAFAS, Nominatim geocoding).

## Configuration

All settings live in a single YAML file: `config.local.yaml`. Copy from the documented template:

```bash
cp config.template.yaml config.local.yaml
```

The config has two main parts:

### Cards section — ordering, visibility, and per-card settings

The `cards:` section controls what's shown and how it behaves. **The order of entries determines display order** on the dashboard.

```yaml
cards:
  weather:
    enabled: true
    units: celsius          # 'celsius' or 'fahrenheit'
    refreshMinutes: 15
    showClothing: true      # clothing suggestion based on weather
    showForecast: true      # 4-day forecast row
    forecastDays: 4         # number of forecast days (1-7)

  rain:
    enabled: true
    forecastHours: 12       # hours ahead to show (1-24)

  departures:
    enabled: true
    refreshSeconds: 30
    maxResults: 5           # departures per direction

  commute:
    enabled: true
    showBike: true          # cycling route
    showTransit: true       # public transit route
    bikeSpeedFactor: 1.5    # multiply OSRM estimate (1.0=optimistic, 1.5=realistic)

  calendar:
    enabled: true
    maxEvents: 5
    showTomorrow: true      # preview of tomorrow's first event
    showCommute: true       # bike/transit time for events with locations
    hidePatterns:           # regex patterns to filter out events
      - 'Arbeit'

  birthdays:
    enabled: true
    lookaheadDays: 7        # how many days ahead

  countdown:
    enabled: true
    maxVacations: 3
    keyword: Urlaub         # calendar keyword to detect vacations

  news:
    enabled: true
    perPage: 5
    cycleSeconds: 30        # auto-advance interval
    defaultCategory: homepage

  # Disable a card by setting enabled: false
  xkcd:
    enabled: false

  # Cards you omit from the list are hidden entirely
```

To reorder cards, just move entries up or down in the YAML. To disable a card, set `enabled: false`. To hide a card completely, remove it from the list.

### Data section — API keys, URLs, and locations

```yaml
location:
  latitude: 52.5075
  longitude: 13.3220

calendar:
  icsUrl: 'https://calendar.google.com/calendar/ical/...'

birthdays:
  icsUrl: 'https://calendar.google.com/calendar/ical/...'

departures:
  hafasAccessId: ''         # VBB HAFAS API key (optional, free)
  stops:
    - id: '900024203'
      label: S Savignyplatz
      splitView: true
      splitLabels: ['Stadtmitte ←', 'Westkreuz →']
      splitKeywords: ['Spandau', 'Westkreuz']
      products:
        suburban: true

commute:
  origin:
    latitude: 52.5075
    longitude: 13.3220
  destinations:
    - label: Office
      latitude: 52.50
      longitude: 13.40

trash:
  icsUrl: '/data/Abfuhrkalender.ics'

github:
  username: your-username

email:
  address: you@gmail.com
  appPassword: ''           # Google App Password (not your regular password)
```

See `config.template.yaml` for the full list of options with comments.

### Per-card settings reference

| Card | Settings |
|------|----------|
| weather | `units`, `refreshMinutes`, `showClothing`, `showForecast`, `forecastDays` |
| rain | `refreshMinutes`, `forecastHours` |
| departures | `refreshSeconds`, `durationMinutes`, `maxResults` |
| commute | `refreshMinutes`, `showBike`, `showTransit`, `bikeSpeedFactor` |
| aqi | `refreshMinutes` |
| uv | `refreshMinutes` |
| pollen | `refreshMinutes`, `types` |
| plants | `warningDays` |
| calendar | `maxEvents`, `refreshMinutes`, `showTomorrow`, `showCommute`, `hidePatterns` |
| birthdays | `refreshMinutes`, `lookaheadDays` |
| countdown | `maxVacations`, `keyword` |
| news | `refreshMinutes`, `perPage`, `cycleSeconds`, `defaultCategory` |
| word | *(none)* |
| spell | `cycleSeconds` |
| history | `minYear` |
| trash | `refreshHours`, `previewDays` |
| github | `refreshMinutes`, `maxEvents` |
| xkcd | *(none)* |
| packages | `refreshMinutes` |
| email | `refreshMinutes` |
| slideshow | `intervalSeconds` |

### Getting your Google Calendar ICS URL

1. Go to [Google Calendar Settings](https://calendar.google.com/calendar/r/settings)
2. Click on your calendar
3. Scroll to "Secret address in iCal format"
4. Copy the URL

### Multi-stop departures

Find your stop ID: https://v6.vbb.transport.rest/locations?query=YOUR+STOP

Product filters: `suburban` (S-Bahn), `subway` (U-Bahn), `bus`, `tram`, `regional`, `express` (ICE/IC).

### Birthday social links

If your birthday calendar events have URLs in the description (WhatsApp, Instagram, etc.), they'll automatically appear as clickable icons.

## Docker

The recommended way to run Homeboard:

```bash
docker compose up -d
```

The `docker-compose.yml` mounts your local config and data:

```yaml
services:
  homeboard:
    build: .
    ports:
      - "7070:7070"
    volumes:
      - ./data:/app/data:ro
      - ./config.local.yaml:/app/config.local.yaml:ro
    restart: unless-stopped
```

To rebuild after updates:

```bash
docker compose up -d --build
```

## Interactive Features

- **Departures** — arrows to switch between stops (S-Bahn, U-Bahn, Bus)
- **Commute** — arrows to switch between destinations, shows live ETA
- **Vacation** — click entry to open week in Google Calendar, click pencil to rename
- **Birthdays** — click name to open Google Contacts, click social icons for messaging
- **News** — category filters, click headline for full article
- **Harry Potter** — arrows to browse content types, daily quiz
- **XKCD** — prev/next/random navigation
- **Packages** — add via form, click to open carrier tracking
- **Plants** — click water button to mark as watered
- **All cards** — external link icon in header opens relevant detail page

## Adapting for Your City

Homeboard is designed for Berlin but works anywhere:

- **Weather, rain, UV, AQI, pollen** — just change `location` coordinates
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
| GitHub | [GitHub Events API](https://docs.github.com/en/rest/activity/events) | No |
| XKCD | [xkcd JSON](https://xkcd.com/info.0.json) | No |

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
├── index.html              # Single page with all card sections
├── config.template.yaml    # Configuration template with documentation
├── config.local.yaml       # Your config (gitignored)
├── css/style.css           # Themes, grid layout, responsive breakpoints
├── js/
│   ├── config.js           # YAML config loader
│   ├── app.js              # Card registry, ordering, and module init
│   ├── i18n.js             # Translations (DE/EN/ES), theme, language switcher
│   ├── clock.js            # Time & date
│   ├── weather.js          # Current + forecast (translated)
│   ├── rain.js             # Hourly precipitation chart
│   ├── sun.js              # Sunrise & sunset
│   ├── airquality.js       # European AQI
│   ├── uv.js               # UV index
│   ├── pollen.js           # Pollen levels
│   ├── departures.js       # Multi-stop departures (interactive)
│   ├── commute.js          # ETA + route legs (interactive)
│   ├── calendar.js         # ICS parser with RRULE + commute
│   ├── birthdays.js        # Birthday countdown + social links
│   ├── holiday.js          # Vacation countdown (click-to-rename)
│   ├── news.js             # Tagesschau headlines + category filters
│   ├── word.js             # Word of the Day
│   ├── harrypotter.js      # The Daily Prophet (rotating HP content)
│   ├── history.js          # On This Day (Wikipedia)
│   ├── trash.js            # Trash pickup schedule
│   ├── packages.js         # Package tracking (localStorage)
│   ├── plants.js           # Plant watering tracker
│   ├── email.js            # Gmail unread count
│   ├── github.js           # GitHub activity feed
│   ├── xkcd.js             # XKCD comic viewer
│   ├── moon.js             # Moon phase calculation
│   └── slideshow.js        # Image carousel
├── server.py               # Python server with CORS proxy
├── data/                   # Local ICS files (gitignored)
├── Dockerfile              # Python Alpine production image
├── docker-compose.yml      # One-command deployment
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
