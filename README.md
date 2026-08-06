# Homeboard

Apartment dashboard showing weather, time, calendar, commute, and a photo slideshow.

## Quick Start

### Localhost (no Docker)

Just serve the folder with any static file server:

```bash
# Python
python3 -m http.server 8080

# or npx
npx serve -p 8080
```

Then open http://localhost:8080

### Docker

```bash
docker compose up -d
```

Dashboard available at http://localhost:8080

## Configuration

1. Copy `js/config.js` to `js/config.local.js`
2. Fill in your API keys and preferences
3. Update `index.html` to load `js/config.local.js` instead of `js/config.js`

### Weather

Get a free API key at [OpenWeatherMap](https://openweathermap.org/api) and set your city.

### Calendar

Use a public ICS feed URL from Google Calendar, iCloud, or any CalDAV provider.

### Commute

Currently shows a static placeholder. To integrate a real provider, edit `js/commute.js` and plug in Google Maps Directions API or a local transit API.

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
│   ├── weather.js       # OpenWeatherMap integration
│   ├── calendar.js      # ICS feed parser
│   ├── commute.js       # Commute time
│   └── slideshow.js     # Image slideshow
├── manifest.json        # PWA manifest
├── Dockerfile
├── docker-compose.yml
└── nginx.conf
```
