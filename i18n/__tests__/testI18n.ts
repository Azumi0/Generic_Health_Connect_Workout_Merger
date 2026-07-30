import { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, LanguageCode, PreferenceCode } from '../translations';

/**
 * Pure language resolution helper for testing logic matching LanguageContext.
 */
function resolveLanguage(preference: PreferenceCode, systemLang: LanguageCode = 'en'): LanguageCode {
  if (preference === 'system') {
    return systemLang && translations[systemLang] ? systemLang : DEFAULT_LANGUAGE;
  }
  if (translations[preference as LanguageCode]) {
    return preference as LanguageCode;
  }
  return DEFAULT_LANGUAGE;
}

describe('i18n & Language Resolution', () => {
  describe('Supported Languages List', () => {
    it('should support at least English and Polish', () => {
      expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(2);
      const hasEn = SUPPORTED_LANGUAGES.some((l) => l.code === 'en');
      const hasPl = SUPPORTED_LANGUAGES.some((l) => l.code === 'pl');
      expect(hasEn).toBe(true);
      expect(hasPl).toBe(true);
    });
  });

  describe('Translation dictionaries integrity', () => {
    it('should have English and Polish dictionaries', () => {
      expect(translations.en).toBeDefined();
      expect(translations.pl).toBeDefined();
    });

    it('should have matching key translations in English and Polish', () => {
      expect(translations.en.app.title).toBe('Workout Deduplicator');
      expect(translations.pl.app.title).toBe('Scalanie Treningów');

      expect(translations.en.settings.title).toBe('Settings');
      expect(translations.pl.settings.title).toBe('Ustawienia');

      expect(translations.en.confirmationModal.title).toBe('Confirm Irreversible Merge');
      expect(translations.pl.confirmationModal.title).toBe('Potwierdź Nieodwracalne Scalanie');
    });
  });

  describe('Language Preference Resolution Rules', () => {
    it('should resolve explicit "en" preference to "en"', () => {
      expect(resolveLanguage('en', 'pl')).toBe('en');
    });

    it('should resolve explicit "pl" preference to "pl"', () => {
      expect(resolveLanguage('pl', 'en')).toBe('pl');
    });

    it('should resolve system preference with Polish system language to "pl"', () => {
      expect(resolveLanguage('system', 'pl')).toBe('pl');
    });

    it('should resolve system preference with English system language to "en"', () => {
      expect(resolveLanguage('system', 'en')).toBe('en');
    });

    it('should fall back to English for unsupported system languages', () => {
      expect(resolveLanguage('system', 'fr' as any)).toBe('en');
      expect(resolveLanguage('system', 'de' as any)).toBe('en');
    });

    it('should fall back to English for invalid preferences', () => {
      expect(resolveLanguage('invalid_pref' as any, 'pl')).toBe('en');
    });
  });
});
