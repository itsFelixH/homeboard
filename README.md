# Homeboard

Apartment dashboard showing weather, time, calendar, commute, sunrise/sunset, and a photo slideshow.

All weather and sun data comes from [Open-Meteo](https://open-meteo.com/) (no API key needed).
Transit routing uses [Transitous](https://transitous.org/) (free, open, no key needed).

## Quick Start

### Localhost (no Docker)

Just serve the folder with any static file server:

```bash
# Python
python3 -m http.server 7070

# or npx
npx serve -p 7070
```

Then open http://localhost:7070

### Docker

```bash
docker compose up -d
```

Dashboard available at http://localhost:7070

## Configuration

1. Copy `js/config.js` to `js/config.local.js`
2. Fill in your API keys and preferences
3. Update `index.html` to load `js/config.local.js` instead of `js/config.js`

### Weather

Uses [Open-Meteo](https://open-meteo.com/) — no API key needed. Just set your latitude/longitude in the `location` block.

### Sunrise/Sunset

Automatically fetched from Open-Meteo based on your configured location.

### Calendar

Use a public ICS feed URL from Google Calendar, iCloud, or any CalDAV provider.

### Commute

Uses [Transitous](https://transitous.org/) for free public transit routing. Set your origin and destination coordinates in the config. Coverage is best in Europe but growing globally.

### Slideshow

Add image paths (local or URL) to the `slideshow.images` array in your config. Create an `images/` folder for local photos.

## Mobile / PWA

The app includes a `manifest.json` for PWA support. On your phone:
- iOS: Open in Safari, tap Share > Add to Home Screen
- Android: Chrome will prompt "Add to Home Screen"

## Project Structure

```
homeboard/
├── index.html
├── css/style.css
├── js/
│   ├── config.js        # Configuration (template)
│   ├── app.js           # Initializer
│   ├── clock.js         # Time & date
│   ├── weather.js       # Open-Meteo weather
│   ├── sun.js           # Sunrise & sunset
│   ├── calendar.js      # ICS feed parser
│   ├── commute.js       # Transitous transit routing
│   └── slideshow.js     # Image slideshow
├── manifest.json        # PWA manifest
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```
