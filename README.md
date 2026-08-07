# Homeboard

Apartment dashboard showing weather, forecasts, rain, air quality, UV index, transit departures, commute times, calendar, sunrise/sunset, vacation countdown, daily facts, and a photo slideshow.

All data comes from free, open APIs — no API keys required.

## Quick Start

### Localhost (no Docker)

```bash
# Copy the config template and fill in your details
cp js/config.template.js js/config.local.js

# Serve with Python
python3 -m http.server 7070
```

Then open http://localhost:7070

### Docker

```bash
docker compose up -d
```

Dashboard available at http://localhost:7070

## Configuration

1. Copy `js/config.template.js` to `js/config.local.js`
2. Fill in your coordinates, calendar URL, and preferences
3. `config.local.js` is gitignored — your personal data stays private

The page loads `config.local.js` automatically and falls back to the template if it's missing.

## APIs Used

All APIs are free and require no API key unless noted.

| Feature | API | Auth | What it provides |
|---------|-----|------|------------------|
| Weather (current + forecast) | [Open-Meteo](https://open-meteo.com/) | None | Temperature, conditions, humidity, wind, 5-day forecast |
| Rain forecast | [Open-Meteo](https://open-meteo.com/en/docs) | None | Hourly precipitation + probability for next 12h |
| Sunrise / Sunset | [Open-Meteo](https://open-meteo.com/) | None | Daily sunrise and sunset times |
| Air Quality (AQI) | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | None | European AQI, PM2.5, PM10 |
| UV Index | [CurrentUVIndex.com](https://currentuvindex.com/api) | None | Real-time UV index + forecast |
| Transit departures | [VBB transport.rest](https://v6.vbb.transport.rest/) | None | Real-time S-Bahn/U-Bahn departures (Berlin/Brandenburg) |
| Commute (transit) | [Transitous](https://transitous.org/) (MOTIS) | None | Public transit journey planning |
| Commute (bike) | [OSRM](https://project-osrm.org/) | None | Cycling route duration + distance |
| Calendar | Any ICS feed (Google Calendar, iCloud, etc.) | None | Today's events parsed from .ics |
| Useless Fact | [uselessfacts.jsph.pl](https://uselessfacts.jsph.pl/) | None | Daily random fact |
| Slideshow images | [Lorem Picsum](https://picsum.photos/) (default) | None | Random placeholder photos |

## Features

- **Clock** — current time and date
- **Weather** — current conditions + 4-day forecast with icons
- **Rain** — 12-hour precipitation bar chart with probability
- **Sunrise/Sunset** — daily sun times
- **Air Quality** — European AQI with PM2.5/PM10 breakdown
- **UV Index** — color-coded current UV level
- **S-Bahn Departures** — real-time timetable for your nearest stop
- **Commute** — transit + bike time to multiple destinations
- **Calendar** — today's events from ICS feed
- **Countdown** — auto-detects next vacation from calendar events
- **Useless Fact** — daily conversation starter
- **Slideshow** — rotating photo display

## Mobile / PWA

The app includes a `manifest.json` for PWA support. On your phone:
- iOS: Open in Safari → Share → Add to Home Screen
- Android: Chrome will prompt "Add to Home Screen"

## Project Structure

```
homeboard/
├── index.html
├── css/style.css
├── js/
│   ├── config.template.js  # Configuration template (committed)
│   ├── config.local.js     # Your config (gitignored)
│   ├── app.js              # Initializer
│   ├── clock.js            # Time & date
│   ├── weather.js          # Open-Meteo current + forecast
│   ├── rain.js             # Hourly precipitation chart
│   ├── sun.js              # Sunrise & sunset
│   ├── airquality.js       # Air quality index
│   ├── uv.js               # UV index
│   ├── departures.js       # VBB S-Bahn departures
│   ├── commute.js          # Transit + bike routing
│   ├── calendar.js         # ICS feed parser
│   ├── countdown.js        # Vacation countdown
│   ├── facts.js            # Daily useless fact
│   └── slideshow.js        # Image slideshow
├── manifest.json           # PWA manifest
├── favicon.svg             # Dashboard favicon
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

## Tech Stack

Pure static site — no build tools, no frameworks, no dependencies. Just HTML, CSS, and vanilla JavaScript served from nginx (Docker) or any static file server.
