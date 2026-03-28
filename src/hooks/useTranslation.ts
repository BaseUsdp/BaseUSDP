/**
 * useTranslation Hook
 *
 * Provides translation functions for the current locale.
 * Loads locale files dynamically and caches them in memory.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type Locale,
  DEFAULT_LOCALE,
  getStoredLocale,
  setStoredLocale,
  getNestedValue,
} from "@/i18n/config";

// In-memory cache of loaded locale data
const localeCache = new Map<Locale, Record<string, any>>();

// Static imports for locale files (Vite will bundle these)
const localeImports: Record<Locale, () => Promise<{ default: Record<string, any> }>> = {
  en: () => import("@/i18n/locales/en.json"),
  es: () => import("@/i18n/locales/es.json"),
  fr: () => import("@/i18n/locales/fr.json"),
  zh: () => import("@/i18n/locales/zh.json"),
  ar: () => import("@/i18n/locales/ar.json"),
};

interface UseTranslationReturn {
  /** Translate a key (dot notation supported) */
  t: (key: string, params?: Record<string, string>) => string;
  /** Current locale code */
  locale: Locale;
  /** Change the active locale */
  setLocale: (locale: Locale) => void;
  /** Whether locale data is still loading */
  isLoading: boolean;
}

export function useTranslation(): UseTranslationReturn {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);
  const [messages, setMessages] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load locale data
  useEffect(() => {
    let cancelled = false;

    async function loadLocale() {
      if (localeCache.has(locale)) {
        setMessages(localeCache.get(locale)!);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const module = await localeImports[locale]();
        const data = module.default;
        localeCache.set(locale, data);
        if (!cancelled) {
          setMessages(data);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(`Failed to load locale: ${locale}`, error);
        // Fall back to English
        if (locale !== DEFAULT_LOCALE && !cancelled) {
          const fallback = await localeImports[DEFAULT_LOCALE]();
          localeCache.set(DEFAULT_LOCALE, fallback.default);
          setMessages(fallback.default);
          setIsLoading(false);
        }
      }
    }

    loadLocale();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Translation function with interpolation support
  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      const value = getNestedValue(messages, key);
      if (!value) return key; // Return the key itself as fallback

      if (!params) return value;

      // Simple interpolation: {{name}} -> params.name
      return value.replace(/\{\{(\w+)\}\}/g, (_: string, paramKey: string) => {
        return params[paramKey] ?? `{{${paramKey}}}`;
      });
    },
    [messages]
  );

  const setLocale = useCallback((newLocale: Locale) => {
    setStoredLocale(newLocale);
    setLocaleState(newLocale);

    // Update document direction for RTL languages
    if (typeof document !== "undefined") {
      document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = newLocale;
    }
  }, []);

  return useMemo(
    () => ({ t, locale, setLocale, isLoading }),
    [t, locale, setLocale, isLoading]
  );
}
