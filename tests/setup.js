const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');

// Expose jsyaml globally
global.jsyaml = jsyaml;
window.jsyaml = jsyaml;

// Mock Lucide icons
global.lucide = {
  createIcons: jest.fn()
};
window.lucide = global.lucide;

// Mock Fetch helper
function createMockResponse(options = {}) {
  return {
    ok: options.ok !== undefined ? options.ok : true,
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    json: async () => (options.json !== undefined ? options.json : {}),
    text: async () => (options.text !== undefined ? options.text : (typeof options.json === 'object' ? JSON.stringify(options.json) : ''))
  };
}
global.createMockResponse = createMockResponse;

global.fetch = window.fetch = jest.fn().mockImplementation(() => Promise.resolve(createMockResponse()));

// Mock Storage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock();
window.localStorage = global.localStorage;

global.sessionStorage = new LocalStorageMock();
window.sessionStorage = global.sessionStorage;

// Mock copyToClipboard
global.copyToClipboard = jest.fn();
window.copyToClipboard = global.copyToClipboard;

// Load HTML template
const htmlPath = path.join(__dirname, '..', 'index.html');
const indexHtml = fs.readFileSync(htmlPath, 'utf8');

// Function to reset DOM
global.resetDOM = () => {
  document.documentElement.innerHTML = indexHtml;
  if (global.State && typeof global.State.invalidate === 'function') {
    global.State.invalidate();
  }
};

// Reset DOM initially
global.resetDOM();

// Load source files in order
const jsDir = path.join(__dirname, '..', 'js');
const modules = [
  'state.js',
  'config.js',
  'themes.js',
  'i18n.js',
  'clock.js',
  'weather.js',
  'rain.js',
  'sun.js',
  'moon.js',
  'airquality.js',
  'uv.js',
  'pollen.js',
  'calendar.js',
  'birthdays.js',
  'commute.js',
  'departures.js',
  'holiday.js',
  'news.js',
  'trash.js',
  'packages.js',
  'plants.js',
  'email.js',
  'history.js',
  'word.js',
  'harrypotter.js',
  'github.js',
  'xkcd.js',
  'slideshow.js'
];

modules.forEach(file => {
  const filePath = path.join(jsDir, file);
  if (fs.existsSync(filePath)) {
    let code = fs.readFileSync(filePath, 'utf8');
    // Normalize top-level declarations to global and window assignments
    code = code.replace(/^function (\w+)/gm, 'global.$1 = window.$1 = function $1');
    code = code.replace(/^(const|let|var) (\w+)\s*=/gm, 'global.$2 = window.$2 =');
    try {
      const fn = new Function(code);
      fn();
    } catch (e) {
      console.error(`Failed to load ${file}:`, e);
    }
  }
});
