import { en, TranslationKeys } from './en';
import { pl } from './pl';

export type LanguageCode = 'en' | 'pl';
export type PreferenceCode = 'system' | LanguageCode;

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
];

export const translations: Record<LanguageCode, TranslationKeys> = {
  en,
  pl,
};

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export { en, pl };
export type { TranslationKeys };

