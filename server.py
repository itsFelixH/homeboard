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

# Register YAML MIME type (not in Python's default mimetypes)
mimetypes.add_type('text/yaml', '.yaml')
mimetypes.add_type('text/yaml', '.yml')

PORT = 7070

# Shared state file (persistent across restarts, synced across devices)
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'state.json')
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
GMAIL_TOKEN_FILE = os.path.join(DATA_DIR, 'gmail_token.json')
_state_lock = threading.Lock()

# Gmail OAuth2 config (loaded from HOMEBOARD_CONFIG at runtime)
_gmail_config = None

def _get_gmail_config():
    """Load Gmail OAuth2 config from config.local.yaml."""
    global _gmail_config
    if _gmail_config is not None:
        return _gmail_config
    try:
        import yaml  # PyYAML available in Python stdlib-like on Alpine
    except ImportError:
        # Fallback: parse manually from the YAML file
        config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.local.yaml')
        if not os.path.exists(config_path):
            return {}
        with open(config_path) as f:
            content = f.read()
        # Simple extraction for client_id and client_secret
        import re
        cid = re.search(r'clientId:\s*[\'"]?([^\s\'"]+)', content)
        csec = re.search(r'clientSecret:\s*[\'"]?([^\s\'"]+)', content)
        _gmail_config = {
            'client_id': cid.group(1) if cid else '',
            'client_secret': csec.group(1) if csec else ''
        }
        return _gmail_config
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.local.yaml')
    if not os.path.exists(config_path):
        return {}
    with open(config_path) as f:
        import yaml
        data = yaml.safe_load(f)
    email_card = (data.get('cards') or {}).get('email') or {}
    _gmail_config = {
        'client_id': email_card.get('clientId', ''),
        'client_secret': email_card.get('clientSecret', '')
    }
    return _gmail_config


def _gmail_read_token():
    """Read stored Gmail refresh/access token."""
    try:
        with open(GMAIL_TOKEN_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _gmail_write_token(token_data):
    """Persist Gmail token to disk."""
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = GMAIL_TOKEN_FILE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(token_data, f, indent=2)
    os.replace(tmp, GMAIL_TOKEN_FILE)


def _gmail_refresh_access_token(refresh_token):
    """Use refresh token to get a new access token."""
    config = _get_gmail_config()
    if not config.get('client_id') or not config.get('client_secret'):
        return None
    data = urllib.parse.urlencode({
        'client_id': config['client_id'],
        'client_secret': config['client_secret'],
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token'
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f'[Gmail] Token refresh failed: {e}')
        return None


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
    'mail.google.com',
    'v6.vbb.transport.rest',
    'api.transitous.org',
    'vbb.demo.hafas.cloud',
    'nominatim.openstreetmap.org',
    'xkcd.com',
]

# Simple in-memory cache (url -> (data, content_type, timestamp))
_cache = {}
CACHE_MAX_ENTRIES = 50

# Per-domain cache TTL (seconds)
CACHE_TTL_MAP = {
    'calendar.google.com': 900,        # 15 min — calendar/birthday feeds
    'nominatim.openstreetmap.org': 3600,  # 1 hour — geocoding results don't change
}
CACHE_TTL_DEFAULT = 300  # 5 min for everything else


def _get_ttl(url):
    """Return cache TTL based on the URL's domain."""
    parsed = urllib.parse.urlparse(url)
    return CACHE_TTL_MAP.get(parsed.hostname, CACHE_TTL_DEFAULT)


def _evict_cache():
    """Remove expired entries; if still over limit, drop oldest."""
    import time
    now = time.time()
    # Remove expired
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
        elif self.path == '/auth/gmail':
            self.handle_gmail_auth()
        elif self.path.startswith('/auth/gmail/callback'):
            self.handle_gmail_callback()
        elif self.path == '/api/gmail/unread':
            self.handle_gmail_unread()
        elif self.path == '/api/gmail/status':
            self.handle_gmail_status()
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

    def handle_gmail_auth(self):
        """Redirect to Google OAuth2 consent screen."""
        config = _get_gmail_config()
        if not config.get('client_id'):
            self.send_error(500, 'Gmail clientId not configured')
            return
        params = urllib.parse.urlencode({
            'client_id': config['client_id'],
            'redirect_uri': f'http://localhost:{PORT}/auth/gmail/callback',
            'response_type': 'code',
            'scope': 'https://www.googleapis.com/auth/gmail.readonly',
            'access_type': 'offline',
            'prompt': 'consent'
        })
        url = f'https://accounts.google.com/o/oauth2/v2/auth?{params}'
        self.send_response(302)
        self.send_header('Location', url)
        self.end_headers()

    def handle_gmail_callback(self):
        """Exchange auth code for tokens and store refresh token."""
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        code = params.get('code', [None])[0]

        if not code:
            error = params.get('error', ['unknown'])[0]
            self._send_html(f'<h1>Gmail auth failed</h1><p>{error}</p><a href="/">Back to dashboard</a>')
            return

        config = _get_gmail_config()
        # Exchange code for tokens
        data = urllib.parse.urlencode({
            'code': code,
            'client_id': config['client_id'],
            'client_secret': config['client_secret'],
            'redirect_uri': f'http://localhost:{PORT}/auth/gmail/callback',
            'grant_type': 'authorization_code'
        }).encode()
        req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        ctx = ssl.create_default_context()

        try:
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                token_data = json.loads(resp.read())
        except Exception as e:
            self._send_html(f'<h1>Token exchange failed</h1><p>{e}</p><a href="/">Back</a>')
            return

        if 'refresh_token' not in token_data:
            self._send_html('<h1>No refresh token</h1><p>Try revoking access at <a href="https://myaccount.google.com/permissions">Google Permissions</a> and retry.</p>')
            return

        # Store tokens
        _gmail_write_token({
            'refresh_token': token_data['refresh_token'],
            'access_token': token_data.get('access_token', ''),
            'expires_at': __import__('time').time() + token_data.get('expires_in', 3600)
        })

        self._send_html('<h1>Gmail connected!</h1><p>You can close this tab.</p><script>setTimeout(()=>window.close(),2000)</script>')

    def handle_gmail_status(self):
        """Check if Gmail is connected (has refresh token)."""
        token = _gmail_read_token()
        connected = token is not None and 'refresh_token' in token
        data = json.dumps({'connected': connected}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)

    def handle_gmail_unread(self):
        """Return unread email count from Gmail API."""
        token = _gmail_read_token()
        if not token or 'refresh_token' not in token:
            data = json.dumps({'error': 'not_connected', 'count': 0}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        import time as _time

        # Refresh access token if expired
        access_token = token.get('access_token', '')
        if _time.time() >= token.get('expires_at', 0):
            refreshed = _gmail_refresh_access_token(token['refresh_token'])
            if refreshed and 'access_token' in refreshed:
                access_token = refreshed['access_token']
                token['access_token'] = access_token
                token['expires_at'] = _time.time() + refreshed.get('expires_in', 3600)
                _gmail_write_token(token)
            else:
                data = json.dumps({'error': 'token_refresh_failed', 'count': 0}).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return

        # Call Gmail API for unread count
        try:
            url = 'https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX'
            req = urllib.request.Request(url)
            req.add_header('Authorization', f'Bearer {access_token}')
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                label_data = json.loads(resp.read())
            unread = label_data.get('messagesUnread', 0)
            data = json.dumps({'count': unread}).encode()
        except urllib.error.HTTPError as e:
            if e.code == 401:
                # Token invalid, clear it
                data = json.dumps({'error': 'token_expired', 'count': 0}).encode()
            else:
                data = json.dumps({'error': str(e), 'count': 0}).encode()
        except Exception as e:
            data = json.dumps({'error': str(e)[:100], 'count': 0}).encode()

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)

    def _send_html(self, body):
        """Send a simple HTML page."""
        html = f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{{font-family:system-ui;background:#09090b;color:#fafafa;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;}}a{{color:#818cf8;}}</style></head><body>{body}</body></html>'
        data = html.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
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
            import time
            now = time.time()

            # Check cache
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
    print(f'✦ Homeboard running at http://localhost:{PORT}')
    server = http.server.HTTPServer(('0.0.0.0', PORT), HomeboardHandler)
    server.serve_forever()
