import unittest
import urllib.request
import urllib.parse
import http.server
import threading
import socket
import json
import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import server

class ServerTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Find an available port
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('127.0.0.1', 0))
        cls.port = sock.getsockname()[1]
        sock.close()

        # Start server in daemon thread
        server.PORT = cls.port
        cls.httpd = http.server.ThreadingHTTPServer(('127.0.0.1', cls.port), server.HomeboardHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_static_index_html(self):
        url = f'http://127.0.0.1:{self.port}/index.html'
        req = urllib.request.urlopen(url)
        self.assertEqual(req.status, 200)
        content = req.read().decode('utf-8')
        self.assertIn('<title>Homeboard</title>', content)

    def test_proxy_disallowed_domain(self):
        url = f'http://127.0.0.1:{self.port}/proxy?url=' + urllib.parse.quote('https://malicious-site.example.com/data')
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(url)
        self.assertEqual(ctx.exception.code, 403)

    def test_proxy_allowed_domain_pattern(self):
        url = f'http://127.0.0.1:{self.port}/proxy?url=' + urllib.parse.quote('https://xkcd.com/info.0.json')
        req = urllib.request.urlopen(url)
        self.assertEqual(req.status, 200)
        data = json.loads(req.read().decode('utf-8'))
        self.assertIn('month', data)

    def test_state_get_and_post(self):
        # POST state
        post_url = f'http://127.0.0.1:{self.port}/state'
        data = json.dumps({'test_key': 'test_value_123'}).encode('utf-8')
        req = urllib.request.Request(post_url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        res = urllib.request.urlopen(req)
        self.assertEqual(res.status, 200)

        # GET state
        get_res = urllib.request.urlopen(post_url)
        self.assertEqual(get_res.status, 200)
        payload = json.loads(get_res.read().decode('utf-8'))
        self.assertEqual(payload.get('test_key'), 'test_value_123')

if __name__ == '__main__':
    unittest.main()
