import unittest
import urllib.request
import urllib.parse
import http.server
import threading
import socket
import json
import os
import sys
import io
from unittest.mock import patch, MagicMock

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
        with urllib.request.urlopen(url) as req:
            self.assertEqual(req.status, 200)
            content = req.read().decode('utf-8')
            self.assertIn('<title>Homeboard</title>', content)

    def test_proxy_disallowed_domain(self):
        url = f'http://127.0.0.1:{self.port}/proxy?url=' + urllib.parse.quote('https://malicious-site.example.com/data')
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            with urllib.request.urlopen(url):
                pass
        self.assertEqual(ctx.exception.code, 403)
        ctx.exception.close()

    @patch.object(server.urllib.request, 'urlopen')
    def test_proxy_allowed_domain_pattern(self, mock_urlopen):
        mock_resp_data = json.dumps({'month': '9', 'num': 2026, 'title': 'Test Comic'}).encode('utf-8')
        mock_response = MagicMock()
        mock_response.read.return_value = mock_resp_data
        mock_response.status = 200
        mock_response.headers = {'Content-Type': 'application/json'}
        mock_response.info.return_value = {'Content-Type': 'application/json'}
        mock_response.__enter__.return_value = mock_response
        mock_response.__exit__.return_value = None
        mock_urlopen.return_value = mock_response

        url = f'http://127.0.0.1:{self.port}/proxy?url=' + urllib.parse.quote('https://xkcd.com/info.0.json')
        with urllib.request.urlopen(url) as req:
            self.assertEqual(req.status, 200)
            data = json.loads(req.read().decode('utf-8'))
            self.assertIn('month', data)
            self.assertEqual(data.get('title'), 'Test Comic')

    def test_state_get_and_post(self):
        # POST state
        post_url = f'http://127.0.0.1:{self.port}/state'
        data = json.dumps({'test_key': 'test_value_123'}).encode('utf-8')
        req = urllib.request.Request(post_url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req) as res:
            self.assertEqual(res.status, 200)

        # GET state
        with urllib.request.urlopen(post_url) as get_res:
            self.assertEqual(get_res.status, 200)
            payload = json.loads(get_res.read().decode('utf-8'))
            self.assertEqual(payload.get('test_key'), 'test_value_123')

if __name__ == '__main__':
    unittest.main()
