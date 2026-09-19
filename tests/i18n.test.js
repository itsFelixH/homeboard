describe('I18n & Lang', () => {
  beforeEach(() => {
    localStorage.clear();
    global.resetDOM();
    Lang.init();
  });

  test('defaults to German (de) language', () => {
    expect(Lang.get()).toBe('de');
  });

  test('returns translated string for default German language', () => {
    expect(i18n('weather')).toBe('Wetter');
    expect(i18n('birthdays')).toBe('Geburtstage');
    expect(i18n('packages')).toBe('Pakete');
  });

  test('switches language to English via localStorage and returns English translations', () => {
    localStorage.setItem('homeboard_lang', 'en');
    Lang.init();
    expect(Lang.get()).toBe('en');
    expect(i18n('weather')).toBe('Weather');
    expect(i18n('birthdays')).toBe('Birthdays');
  });

  test('switches language to Spanish via localStorage and returns Spanish translations', () => {
    localStorage.setItem('homeboard_lang', 'es');
    Lang.init();
    expect(Lang.get()).toBe('es');
    expect(i18n('weather')).toBe('Clima');
    expect(i18n('birthdays')).toBe('Cumpleaños');
  });

  test('falls back to English or raw key if key is missing in active locale', () => {
    localStorage.setItem('homeboard_lang', 'de');
    Lang.init();
    expect(i18n('non_existent_key_12345')).toBe('non_existent_key_12345');
  });

  test('Lang.init populates language dropdown', () => {
    Lang.init();
    const btn = document.getElementById('lang-btn');
    const menu = document.getElementById('lang-menu');
    expect(btn).not.toBeNull();
    expect(menu).not.toBeNull();
    expect(menu.querySelectorAll('button').length).toBe(3);
  });
});
