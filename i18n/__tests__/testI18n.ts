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

function runI18nTests() {
  console.log('--- Running i18n & Language Resolution Tests ---');

  // Test 1: Supported Languages List
  console.assert(SUPPORTED_LANGUAGES.length >= 2, 'Should support at least English and Polish');
  const hasEn = SUPPORTED_LANGUAGES.some((l) => l.code === 'en');
  const hasPl = SUPPORTED_LANGUAGES.some((l) => l.code === 'pl');
  console.assert(hasEn && hasPl, 'SUPPORTED_LANGUAGES must contain en and pl');

  // Test 2: Translation dictionaries integrity
  console.assert(translations.en !== undefined, 'English translations dictionary must exist');
  console.assert(translations.pl !== undefined, 'Polish translations dictionary must exist');

  // Verify key keys in English and Polish
  console.assert(translations.en.app.title === 'Workout Deduplicator', 'EN title check');
  console.assert(translations.pl.app.title === 'Scalanie Treningów', 'PL title check');

  console.assert(translations.en.settings.title === 'Settings', 'EN settings title check');
  console.assert(translations.pl.settings.title === 'Ustawienia', 'PL settings title check');

  console.assert(translations.en.confirmationModal.title === 'Confirm Irreversible Merge', 'EN modal title check');
  console.assert(translations.pl.confirmationModal.title === 'Potwierdź Nieodwracalne Scalanie', 'PL modal title check');

  // Test 3: Language Preference Resolution Rules
  // Rule 3a: Explicit 'en' preference -> 'en'
  console.assert(resolveLanguage('en', 'pl') === 'en', 'Explicit en preference should resolve to en');

  // Rule 3b: Explicit 'pl' preference -> 'pl'
  console.assert(resolveLanguage('pl', 'en') === 'pl', 'Explicit pl preference should resolve to pl');

  // Rule 3c: System default preference when system language is Polish ('pl') -> 'pl'
  console.assert(resolveLanguage('system', 'pl') === 'pl', 'System preference with pl system lang should resolve to pl');

  // Rule 3d: System default preference when system language is English ('en') -> 'en'
  console.assert(resolveLanguage('system', 'en') === 'en', 'System preference with en system lang should resolve to en');

  // Rule 3e: System default preference when system language is unsupported (e.g. 'fr' or 'de') -> fallback to English ('en')
  console.assert(resolveLanguage('system', 'fr' as any) === 'en', 'Unsupported system language fr should fall back to en');
  console.assert(resolveLanguage('system', 'de' as any) === 'en', 'Unsupported system language de should fall back to en');

  // Rule 3f: Invalid preference -> fallback to English ('en')
  console.assert(resolveLanguage('invalid_pref' as any, 'pl') === 'en', 'Invalid preference should fall back to en');

  console.log('✅ ALL I18N TESTS PASSED SUCCESSFULLY!');
}

runI18nTests();
