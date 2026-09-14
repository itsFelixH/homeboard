---
name: homeboard
description: "Architecture, modules, API integrations, theme engine, and deployment runbook for Homeboard - the self-hosted apartment smart display dashboard."
category: frontend
risk: safe
author: felix
date_added: "2025-08-16"
---

# Homeboard Smart Dashboard

Architecture, module specifications, API integrations, and deployment guidelines for Homeboard (`http://bundepi:7070`).

## When to Use

- Developing or debugging Homeboard features, widgets, or styles
- Adding new dashboard cards, API integrations, or data feeds
- Modifying themes or layout styling in `css/style.css`
- Updating `config.template.yaml` or `config.local.yaml`
- Deploying updates to the production server on `bundepi`
- Understanding how Homeboard integrates with PiBoard and the media server stack

## Architecture & Tech Stack

Homeboard is a lightweight, zero-framework single-page dashboard designed for wall-mounted tablets and always-on displays.

- **Frontend:** Vanilla HTML5, Vanilla JavaScript (ES modules in `js/`), Vanilla CSS (`css/style.css`)
- **Themes:** Dynamic YAML-based theme definitions in `themes/` (`dark.yaml`, `light.yaml`, `nord.yaml`, `pixel.yaml`)
- **Backend:** `server.py` (Python 3 HTTP server + CORS proxy and configuration loader on port 7070)
- **Deployment:** Docker container (`ghcr.io/itsfelixh/homeboard` or local build via `docker-compose.yml`)
- **Local Dev Repo:** `C:\Git\homeboard` (Windows host)
- **Remote Production Repo:** `\\bundepi\home\git\homeboard` (`/home/felix/git/homeboard`)

## Core JavaScript Modules (`js/`)

| Module | Purpose | API / Data Source |
|--------|---------|-------------------|
| `config.js` | Parses YAML config and exposes `HOMEBOARD_CONFIG` | `config.local.yaml` via `js-yaml.min.js` |
| `weather.js` | Current weather conditions & multi-day forecast | Open-Meteo API |
| `rain.js` | Hourly precipitation probability bar chart | Open-Meteo Precipitation API |
| `sun.js` / `moon.js` | Sunrise/sunset & calculated moon phase | Open-Meteo Sun API / algorithmic |
| `airquality.js` | European AQI with PM2.5 and PM10 breakdown | Open-Meteo Air Quality API |
| `uv.js` / `pollen.js` | UV index and pollen levels (grass, birch, alder, ragweed) | Open-Meteo Pollen & Solar APIs |
| `departures.js` | Real-time transit departures with split direction columns | VBB HAFAS API (S-Bahn, U-Bahn, Bus, Tram) |
| `commute.js` | Live transit and bike commute ETAs to work destinations | BVG Routing / OpenRouteService |
| `calendar.js` | Multi-day agenda with place rules, smart categories, interactive mode switching, 1-tap Google Maps route & Return Home | RFC 5545 ICS feeds + Nominatim / Photon / OSRM / HAFAS |
| `birthdays.js` | Upcoming birthdays with one-tap social chat links | ICS feed (WhatsApp, Telegram, Signal, LinkedIn) |
| `holiday.js` | Vacation countdown detector and event linking | ICS calendar feed |
| `news.js` | Live news ticker with category filters and thumbnails | Tagesschau API |
| `history.js` | "On This Day" historical events | Wikipedia REST API |
| `harrypotter.js` | "The Daily Prophet" rotating HP trivia, spells, and quizzes | Curated JSON datasets |
| `word.js` | English Word of the Day with definitions and IPA phonetics | Dictionary API |
| `trash.js` | Next scheduled trash collection dates | Municipal ICS calendar |
| `github.js` | Recent public commit and PR activity feed | GitHub REST API |
| `xkcd.js` | Latest XKCD webcomic with interactive navigation | XKCD API via Python proxy |
| `packages.js` | Package tracking with local persistence | DHL, Hermes, DPD APIs + `localStorage` |
| `email.js` | Unread email badge count | Gmail IMAP / API |
| `plants.js` | Plant watering tracker with reminders | Local state storage |
| `slideshow.js` | Rotating photo display gallery | Local images / Media folder |
| `themes.js` | Dynamic theme switcher and CSS variable injector | `themes/*.yaml` |
| `i18n.js` | Multi-language translation support (DE / EN / ES) | Translation dictionaries |

## Configuration Schema (`config.template.yaml`)

Configuration is split into sections:
- `location`: Coordinates (lat/lon) and address for Berlin weather, air quality, transit, and commute routing.
- `cards.calendar`:
  - `icsUrl`: Main agenda calendar stream (Google / Apple / Nextcloud).
  - `showCommute`: Automatic walk/bike/transit duration calculation to event locations.
  - `showCategories`: Smart category detection and colored vertical left stripes.
  - `bufferMinutes`: Default pre-event arrival buffer.
  - `categories`: Customizable category tags (`icon`, `color`, `match` keywords/regex with whole-word safety).
  - `places`: Granular per-venue rules with paired venue name and street address matching, `modes` filtering, `preferredMode`, `preferredLines`, `rainFallbackMode`, and `bufferMinutes`.
- `cards.departures`: Station IDs, line filters, and split-column directional rules.
- `cards.commute`: Commute targets with transport mode preferences (e.g. transit vs. bike).
- `theme`: Dynamic theme selection (`dark`, `light`, `nord`, `pixel`).

## Local Development & Deployment Runbook

### 1. Local Development (Windows)
```powershell
cd C:\Git\homeboard
python server.py 7070
# Open http://localhost:7070 in browser
```

### 2. Git Deployment Workflow
1. Commit changes locally following Conventional Commits format:
   ```bash
   git commit -m "feat(calendar): add place rules and customizable smart categories"
   git push origin main
   ```
2. Pull on `bundepi` and rebuild container:
   ```bash
   ssh felix@bundepi "cd /home/felix/git/homeboard && git pull && docker compose up --build -d"
   ```

### 3. PiBoard Integration
- Homeboard is monitored on PiBoard at `http://bundepi:5051` under the **Home** Services Portal (:7070).
- Monitored by `piboard-data.sh` via `DOCKER_CONTAINERS` array in `~/kometa/scripts/config.yml`.
