#!/usr/bin/env python3
"""
Homeboard server with CORS proxy for external feeds (Google Calendar, etc.)
Serves static files + /proxy?url=<encoded_url>
"""
import http.server
import urllib.request
import urllib.parse
import ssl
import mimetypes
import json
import os
import threading
import time

# Register YAML MIME type (not in Python's default mimetypes)
mimetypes.add_type('text/yaml', '.yaml')
mimetypes.add_type('text/yaml', '.yml')

PORT = 7070

# Shared state file (persistent across restarts, synced across devices)
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'state.json')
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
_state_lock = threading.Lock()


def _read_state():
    """Read shared state from disk."""
    try:
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_state(state):
    """Write shared state to disk atomically."""
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    tmp = STATE_FILE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, STATE_FILE)

# Domains allowed through the proxy
ALLOWED_DOMAINS = [
    'calendar.google.com',
    'v6.vbb.transport.rest',
    'api.transitous.org',
    'vbb.demo.hafas.cloud',
    'nominatim.openstreetmap.org',
    'photon.komoot.io',
    'xkcd.com',
]

# TTL per domain/URL pattern in seconds
DEFAULT_TTL = 300  # 5 min fallback
TTL_RULES = [
    ('calendar.google.com', 900),       # 15 min - calendar feeds
    ('v6.vbb.transport.rest', 30),      # 30s - live departures
    ('vbb.demo.hafas.cloud', 30),       # 30s - live departures
    ('api.transitous.org', 60),         # 1 min - routing
    ('nominatim.openstreetmap.org', 86400), # 24h - geocoding
    ('photon.komoot.io', 86400),        # 24h - geocoding
    ('xkcd.com', 3600),                 # 1h - daily comic
]

# In-memory proxy response cache: { url: (data_bytes, content_type, timestamp) }
_cache = {}
_cache_lock = threading.Lock()
CACHE_MAX_ENTRIES = 200

# Proxy rate limiting (per-IP token bucket)
RATE_LIMIT = 60       # max requests per window
RATE_WINDOW = 60      # window in seconds (1 minute)
_rate_buckets = {}  # ip -> [tokens, last_refill_time]
_rate_lock = threading.Lock()

def _check_rate_limit(ip):
    """Token bucket rate limiter. Returns True if request is allowed."""
    now = time.time()
    with _rate_lock:
        if ip not in _rate_buckets:
            _rate_buckets[ip] = [RATE_LIMIT - 1, now]
            return True
        tokens, last = _rate_buckets[ip]
        # Refill tokens based on elapsed time
        elapsed = now - last
        tokens = min(RATE_LIMIT, tokens + (elapsed * RATE_LIMIT / RATE_WINDOW))
        if tokens >= 1:
            _rate_buckets[ip] = [tokens - 1, now]
            return True
        else:
            _rate_buckets[ip] = [tokens, last]
            return False

def _get_ttl(url):
    for domain, ttl in TTL_RULES:
        if domain in url:
            return ttl
    return DEFAULT_TTL


def _evict_cache():
    """Remove expired entries, then LRU if still over max."""
    now = time.time()
    expired = [k for k, (_, _, ts) in _cache.items() if now - ts >= _get_ttl(k)]
    for k in expired:
        del _cache[k]
    # If still too large, evict oldest entries
    while len(_cache) > CACHE_MAX_ENTRIES:
        oldest_key = min(_cache, key=lambda k: _cache[k][2])
        del _cache[oldest_key]


class HomeboardHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/proxy?'):
            self.handle_proxy()
        elif self.path == '/state':
            self.handle_state_get()
        elif self.path == '/api/photos':
            self.handle_photos_list()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/state':
            self.handle_state_post()
        else:
            self.send_error(404)

    def handle_state_get(self):
        """Return the full shared state as JSON."""
        with _state_lock:
            state = _read_state()
        data = json.dumps(state).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)

    def handle_state_post(self):
        """Merge posted JSON into shared state and persist."""
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            updates = json.loads(body)
            if not isinstance(updates, dict):
                self.send_error(400, 'Body must be a JSON object')
                return
        except (json.JSONDecodeError, ValueError) as e:
            self.send_error(400, f'Invalid JSON: {e}')
            return

        with _state_lock:
            state = _read_state()
            # Shallow merge: top-level keys are replaced
            state.update(updates)
            _write_state(state)

        data = json.dumps(state).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_photos_list(self):
        """List image files in data/photos/ for slideshow auto-discovery."""
        photos_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'photos')
        IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'}
        images = []
        if os.path.isdir(photos_dir):
            for f in sorted(os.listdir(photos_dir)):
                if os.path.splitext(f)[1].lower() in IMAGE_EXTS:
                    images.append(f'/data/photos/{f}')
        data = json.dumps(images).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'public, max-age=300')
        self.end_headers()
        self.wfile.write(data)

    def handle_proxy(self):
        # Rate limit by client IP
        client_ip = self.client_address[0]
        if not _check_rate_limit(client_ip):
            self.send_error(429, 'Too many requests')
            return

        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        url = params.get('url', [None])[0]

        if not url:
            self.send_error(400, 'Missing url parameter')
            return

        parsed = urllib.parse.urlparse(url)
        if parsed.hostname not in ALLOWED_DOMAINS:
            self.send_error(403, f'Domain not allowed: {parsed.hostname}')
            return

        try:
            now = time.time()

            # Check cache
            with _cache_lock:
                if url in _cache:
                    data, ctype, ts = _cache[url]
                    if now - ts < _get_ttl(url):
                        self.send_response(200)
                        self.send_header('Content-Type', ctype)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Cache-Control', 'public, max-age=300')
                        self.send_header('Content-Length', str(len(data)))
                        self.send_header('X-Cache', 'HIT')
                        self.end_headers()
                        self.wfile.write(data)
                        return

            ctx = ssl.create_default_context()
            # Ensure URL is properly quoted (spaces etc.) without double-encoding existing %XX
            url_parts = urllib.parse.urlsplit(url)
            url = urllib.parse.urlunsplit(url_parts._replace(
                path=urllib.parse.quote(url_parts.path, safe='/%:@'),
                query=urllib.parse.quote(url_parts.query, safe='=&%+:@')
            ))
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Homeboard/1.0',
                'Accept': '*/*'
            })
            # Support Basic Auth via query parameter
            auth = params.get('auth', [None])[0]
            if auth:
                req.add_header('Authorization', f'Basic {auth}')
            with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
                data = resp.read()
                ctype = resp.headers.get('Content-Type', 'text/plain')

            # Store in cache
            with _cache_lock:
                _cache[url] = (data, ctype, now)
                _evict_cache()

            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=300')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('X-Cache', 'MISS')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            msg = str(e)[:200]
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(f'Proxy error: {msg}'.encode())

    def end_headers(self):
        super().end_headers()

    def log_message(self, format, *args):
        # Quieter logs - only show errors and proxy requests
        msg = format % args
        if '/proxy' in msg or '4' == msg[0] or '5' == msg[0]:
            super().log_message(format, *args)


if __name__ == '__main__':
    import sys
    print(f'✦ Homeboard running at http://localhost:{PORT}', flush=True)
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), HomeboardHandler)
    server.serve_forever()
