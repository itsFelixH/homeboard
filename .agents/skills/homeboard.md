---
name: Homeboard
description: Project context and coding conventions for the Homeboard dashboard
---

# Homeboard — Project Context

## Overview

Homeboard is a personal apartment dashboard (single-page app) for a wall-mounted tablet. It displays weather, transit, calendar, news, and other widgets in a clean grid layout. Designed for Berlin but configurable for any city.

## Architecture

- **No build tools, no frameworks, no npm.** Pure vanilla JS modules (IIFE pattern), one CSS file, one HTML file.
- Each widget is a self-contained JS module in `js/` exposing `{ init }` (and optionally `switchTo`, `remove`) via an IIFE.
- Modules are initialized in `js/app.js` on DOMContentLoaded via a `CARD_REGISTRY` that maps card IDs to CSS class names and init functions.
- Card display order and visibility are driven by `HOMEBOARD_CONFIG.cards` (loaded from YAML config). Cards not listed or set to `enabled: false` are hidden.
- External data is fetched client-side directly or through the Python server's `/proxy` endpoint for domains that need CORS or a proper User-Agent.
- Configuration lives in `config.local.yaml` (gitignored, root directory). Falls back to `config.template.yaml`. Parsed by `js/config.js` using `js/vendor/js-yaml.min.js`.
- Shared state (plants, packages, countdown names) is persisted server-side via `js/state.js` → `data/state.json`, replacing localStorage for cross-device sync.

## Initialization Flow

1. `ConfigLoader.load()` and `Themes.load()` run in parallel.
2. `Theme.init()` and `Lang.init()` apply saved preferences.
3. `app.js` reads `HOMEBOARD_CONFIG.cards` key order, reorders card DOM elements to match, hides disabled/unlisted cards.
4. `Clock.init()` runs unconditionally (always-on).
5. Each enabled card's `init()` is called from the registry. Errors are caught per-card so one failure doesn't block others.
6. After 15 seconds, any remaining "Loading..." placeholders are replaced with "--".

## Config System

- **Format**: YAML, parsed client-side by `js-yaml` (bundled in `js/vendor/js-yaml.min.js`).
- **Files**: `config.local.yaml` (user, gitignored) → `config.template.yaml` (committed fallback).
- **Structure**: Top-level `location`, `greeting`, and `cards` sections. Card key order = display order. Each card has `enabled: true/false` plus card-specific settings.
- **Caching**: `ConfigLoader` caches parsed YAML in sessionStorage (keyed by `CACHE_VERSION`) to avoid re-fetching on the 4-hour auto-refresh.
- **Flattening**: `buildConfig()` creates both `HOMEBOARD_CONFIG.cards` (raw) and per-module shortcut keys (`HOMEBOARD_CONFIG.weather`, `HOMEBOARD_CONFIG.commute`, etc.).
- **Typo detection**: Unknown card IDs trigger a console warning.
- `js/config.js` also exposes `window.getTransitLineStyle(line)` — returns `{ bg, fg }` colors for Berlin S-Bahn, U-Bahn, MetroTram, MetroBus, Express Bus, and Regional train lines.

## Theme System

- **Data-driven YAML themes** in `themes/` directory: `index.yaml` registers available themes.
- **Four themes**: dark, light, nord, pixel. Each is a `.yaml` file with `name`, `icon`, `colors`, and `style` properties.
- `js/themes.js` (`Themes` IIFE) loads the active theme eagerly for fast first paint, then fetches remaining themes in background for the picker menu.
- Themes define colors (`bg`, `surface`, `border`, `text`, `accent`, etc.) and style properties (`font`, `radius`, `spacing`, `shadow`, `borders`, `header-weight`, `transitions`, `glow`).
- `Themes.apply(id)` sets CSS custom properties on `document.documentElement` and legacy aliases (`--text-2`, `--text-3`, `--cyan`, `--green`, `--amber`, `--red`).
- To add a new theme: create `themes/mytheme.yaml`, add the ID to `themes/index.yaml`.

## Code Conventions

- Vanilla JavaScript only. No TypeScript, no JSX, no imports/exports.
- Each module is a `const ModuleName = (() => { ... return { init }; })();` IIFE.
- Use `async/await` for fetches. Handle errors with try/catch and render a fallback in the DOM.
- CSS uses custom properties for theming, set dynamically by the theme system.
- i18n strings go in `js/i18n.js` under `I18N_STRINGS[lang][key]`. Use `i18n('key')` in modules.
- For inline language-dependent text (e.g., weather descriptions), use `Lang.get()` to pick the right translation set.
- IDs in HTML match `document.getElementById(...)` calls in the corresponding module.
- Lucide icons loaded from CDN (pinned version 0.460.0). `js-yaml` bundled in `js/vendor/`.
- Interactive cards use arrows (`card-nav`) in the card header for switching views. Navigation containers use `margin-left: auto` to align right.
- External links use the `.card-header-link` class with the lucide `external-link` icon, always positioned last in the card header.
- Social/brand icons use inline SVGs with `.birthday-social` class and brand-specific hover colors.
- For cross-device persistent data, use `State.get(key)` / `State.set(key, value)` instead of localStorage.

## Server

- `server.py` is the **production server** — a Python `http.server` running on port 7070.
- Serves static files + several API endpoints:
  - `/proxy?url=<encoded_url>` — CORS proxy with domain allowlist and in-memory cache (50 entries, per-domain TTL).
  - `/state` GET/POST — shared state persistence (`data/state.json`), thread-safe.
  - `/auth/gmail` — OAuth2 initiation for Gmail.
  - `/auth/gmail/callback` — OAuth2 callback, exchanges code for tokens.
  - `/api/gmail/unread` — Gmail unread count with auto token refresh.
  - `/api/gmail/status` — Check if Gmail is connected.
  - `/api/photos` — List images in `data/photos/` for slideshow.
- Allowed proxy domains: `calendar.google.com`, `mail.google.com`, `v6.vbb.transport.rest`, `api.transitous.org`, `vbb.demo.hafas.cloud`, `nominatim.openstreetmap.org`, `photon.komoot.io`, `xkcd.com`.
- Gmail tokens stored in `data/gmail_token.json`.

## Deployment

- Runs via Docker: `docker compose up -d --build`.
- `Dockerfile`: `python:3.12-alpine`, runs `python3 server.py`. No nginx.
- `docker-compose.yml` maps port 7070, mounts `./data:/app/data` and `config.local.yaml` as read-only.
- `restart: unless-stopped` keeps it running permanently across reboots.
- After code changes, rebuild: `docker compose up -d --build`.
- `nginx.conf` exists in the repo but is **not used** by the current Docker setup.

## Key Rules

- Never commit `config.local.yaml` — it contains personal calendar URLs, coordinates, and OAuth credentials.
- Keep modules independent. They should not import from or depend on other modules (except reading `HOMEBOARD_CONFIG`, `State`, `window._calendarCache`, and `Lang.get()`).
- All external API calls should be free, no-key-required APIs where possible (exception: Gmail OAuth2 in the email card).
- The dashboard auto-refreshes via `<meta http-equiv="refresh" content="14400">` (4 hours). Modules have their own refresh intervals.
- Keep the UI performant for a Raspberry Pi browser — no heavy animations, no large DOM trees.
- All user-facing text must support DE/EN/ES via i18n.
- Use date-seeded random picks (not `Math.random()`) for daily-rotating content so it stays consistent across page loads.

## Testing

There is no test framework. Verify changes by running `python3 server.py` and checking the browser at `http://localhost:7070`. Use `node --check js/filename.js` to verify syntax.

## File Layout

```
index.html              — Single page, grid layout, all widget sections
css/style.css           — All styles, theming, responsive breakpoints (mobile: 650px, tablet: 1100px)
config.template.yaml    — YAML config template (committed)
config.local.yaml       — User YAML config (gitignored)
js/app.js               — Card registry + config-driven initializer
js/config.js            — YAML config loader (ConfigLoader) + transit line colors
js/state.js             — Shared server-side state (State) — cross-device persistence
js/themes.js            — Data-driven YAML theme loader
js/i18n.js              — Translations (DE/EN/ES) + Theme + Lang modules
js/clock.js             — Time, date & greeting
js/weather.js           — Current + forecast (Open-Meteo, translated)
js/rain.js              — Precipitation chart (Open-Meteo)
js/sun.js               — Sunrise & sunset (Open-Meteo)
js/airquality.js        — European AQI (Open-Meteo Air Quality)
js/uv.js                — UV index (currentuvindex.com)
js/pollen.js            — Pollen levels (Open-Meteo Air Quality)
js/departures.js        — Multi-stop transit departures (VBB HAFAS), interactive switching
js/commute.js           — ETA chips + route pills (HAFAS/Transitous + OSRM), interactive switching
js/calendar.js          — ICS parser with RRULE support + commute for events with locations
js/birthdays.js         — Birthday countdown with social links (WhatsApp, Instagram, etc.)
js/holiday.js           — Vacation countdown, click-to-rename, links to Google Calendar
js/news.js              — Tagesschau headlines with thumbnails
js/word.js              — Word of the Day (Free Dictionary API)
js/harrypotter.js       — "The Daily Prophet" — rotating HP content (spells, characters, houses, books, trivia)
js/history.js           — On This Day (Wikipedia), clickable to article
js/trash.js             — BSR trash schedule from ICS
js/packages.js          — Package tracking (DHL/Hermes/DPD, server-side state)
js/plants.js            — Plant watering tracker (server-side state, configurable warning days)
js/github.js            — GitHub public activity feed (no API key needed)
js/email.js             — Gmail unread count (OAuth2 via server endpoints)
js/xkcd.js              — XKCD comics with prev/next/random navigation
js/moon.js              — Moon phase calculation
js/slideshow.js         — Image carousel (auto-discovers photos from data/photos/)
js/vendor/js-yaml.min.js — YAML parser (bundled dependency)
themes/index.yaml       — Theme registry
themes/dark.yaml        — Dark theme (default)
themes/light.yaml       — Light theme
themes/nord.yaml        — Nord / Arctic theme
themes/pixel.yaml       — Retro pixel theme
server.py               — Production server: static files + CORS proxy + state API + Gmail OAuth
data/state.json         — Persisted shared state (gitignored)
data/gmail_token.json   — Gmail OAuth tokens (gitignored)
data/photos/            — Slideshow images (gitignored)
data/Abfuhrkalender.ics — Local trash schedule
Dockerfile              — Python 3.12 Alpine production image
docker-compose.yml      — One-command deployment
nginx.conf              — Unused (legacy)
manifest.json           — PWA manifest
favicon.svg             — Dashboard grid icon
```
