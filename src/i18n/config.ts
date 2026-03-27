/**
 * i18n Configuration
 *
 * Lightweight internationalization system for BASEUSDP.
 * Uses JSON locale files and a React context/hook pattern
 * instead of heavy libraries like react-i18next.
 */

export type Locale = "en" | "es" | "fr" | "zh" | "ar";

export interface LocaleConfig {
  code: Locale;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  dateFormat: string;
  numberFormat: {
    decimal: string;
    thousands: string;
  };
}

export const SUPPORTED_LOCALES: Record<Locale, LocaleConfig> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    direction: "ltr",
    dateFormat: "MM/DD/YYYY",
    numberFormat: { decimal: ".", thousands: "," },
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousands: "." },
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousands: " " },
  },
  zh: {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
    direction: "ltr",
    dateFormat: "YYYY/MM/DD",
    numberFormat: { decimal: ".", thousands: "," },
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    direction: "rtl",
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: "٫", thousands: "٬" },
  },
};

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "baseusdp_locale";

/**
 * Detect the user's preferred locale from browser settings.
 * Falls back to English if no supported locale is detected.
 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const browserLangs = navigator.languages ?? [navigator.language];
  for (const lang of browserLangs) {
    const code = lang.split("-")[0].toLowerCase() as Locale;
    if (code in SUPPORTED_LOCALES) return code;
  }
  return DEFAULT_LOCALE;
}

/**
 * Get the stored locale from localStorage, falling back to browser detection.
 */
export function getStoredLocale(): Locale {
  if (typeof localStorage === "undefined") return detectBrowserLocale();
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && stored in SUPPORTED_LOCALES) return stored as Locale;
  return detectBrowserLocale();
}

/**
 * Store the user's locale preference.
 */
export function setStoredLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

/**
 * Nested key lookup using dot notation.
 * e.g. getNestedValue({ dashboard: { title: "Dashboard" } }, "dashboard.title") => "Dashboard"
 */
export function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  return path.split(".").reduce((current, key) => current?.[key], obj) as string | undefined;
}
