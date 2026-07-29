import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { enUS, pl as plLocale, Locale } from 'date-fns/locale';

import {
  translations,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LanguageCode,
  PreferenceCode,
  LanguageInfo,
} from './translations';

const LANGUAGE_STORAGE_KEY = '@app_language_preference';

const dateFnsLocales: Record<LanguageCode, Locale> = {
  en: enUS,
  pl: plLocale,
};

/**
 * Detect system language code (e.g. 'pl', 'en').
 * Falls back to DEFAULT_LANGUAGE if system language is not supported.
 */
export function getSystemLanguageCode(): LanguageCode {
  try {
    const locales = Localization.getLocales?.();
    if (locales && locales.length > 0 && locales[0].languageCode) {
      const code = locales[0].languageCode.toLowerCase() as LanguageCode;
      if (translations[code]) {
        return code;
      }
    }
  } catch {
    // Fallback if Localization is not initialized
  }

  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      const lang = locale.split('-')[0].toLowerCase() as LanguageCode;
      if (translations[lang]) {
        return lang;
      }
    }
  } catch {
    // Fallback if Intl is unavailable
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Resolve active language code from stored preference and system locale.
 */
export function resolveLanguage(preference: PreferenceCode): LanguageCode {
  if (preference === 'system') {
    return getSystemLanguageCode();
  }
  if (translations[preference as LanguageCode]) {
    return preference as LanguageCode;
  }
  return DEFAULT_LANGUAGE;
}

export interface LanguageContextType {
  language: LanguageCode;
  preference: PreferenceCode;
  setPreference: (pref: PreferenceCode) => Promise<void>;
  systemLanguage: LanguageCode;
  t: (key: string, params?: Record<string, string | number>) => string;
  dateFnsLocale: Locale;
  supportedLanguages: LanguageInfo[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<PreferenceCode>('system');
  const [systemLanguage, setSystemLanguage] = useState<LanguageCode>(() => getSystemLanguageCode());

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((savedPref) => {
        if (savedPref && (savedPref === 'system' || translations[savedPref as LanguageCode])) {
          setPreferenceState(savedPref as PreferenceCode);
        }
      })
      .catch((err) => console.error('Failed to load language preference:', err));

    setSystemLanguage(getSystemLanguageCode());
  }, []);

  const setPreference = useCallback(async (newPref: PreferenceCode) => {
    setPreferenceState(newPref);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newPref);
    } catch (err) {
      console.error('Failed to save language preference:', err);
    }
  }, []);

  const language = useMemo(() => resolveLanguage(preference), [preference]);
  const dateFnsLocale = useMemo(() => dateFnsLocales[language] || enUS, [language]);

  /**
   * Helper function for translation key lookup with parameter interpolation.
   */
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const parts = key.split('.');
      let current: any = translations[language] || translations[DEFAULT_LANGUAGE];
      let fallback: any = translations[DEFAULT_LANGUAGE];

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          current = undefined;
        }

        if (fallback && typeof fallback === 'object' && part in fallback) {
          fallback = fallback[part];
        } else {
          fallback = undefined;
        }
      }

      let result = typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : key;

      if (params && typeof result === 'string') {
        Object.keys(params).forEach((paramKey) => {
          result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(params[paramKey]));
        });
      }

      return result;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      preference,
      setPreference,
      systemLanguage,
      t,
      dateFnsLocale,
      supportedLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, preference, setPreference, systemLanguage, t, dateFnsLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
