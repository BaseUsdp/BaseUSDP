/**
 * LanguageSwitcher Component
 *
 * Dropdown component that allows users to switch the application language.
 * Integrates with the useTranslation hook and supports all configured locales.
 */

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  /** Additional CSS class names */
  className?: string;
  /** Show native language names instead of English names */
  showNative?: boolean;
}

export function LanguageSwitcher({ className = "", showNative = true }: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const currentLocale = SUPPORTED_LOCALES[locale];
  const localeEntries = Object.values(SUPPORTED_LOCALES);

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select language"
      >
        <span className="text-base" role="img" aria-hidden="true">
          {getLocaleFlag(locale)}
        </span>
        <span>{showNative ? currentLocale.nativeName : currentLocale.name}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-border bg-background py-1 shadow-lg"
          role="listbox"
          aria-label="Available languages"
        >
          {localeEntries.map((loc) => (
            <button
              key={loc.code}
              type="button"
              role="option"
              aria-selected={loc.code === locale}
              onClick={() => handleSelect(loc.code)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted ${
                loc.code === locale ? "bg-muted font-semibold text-primary" : "text-foreground"
              }`}
            >
              <span className="text-base" role="img" aria-hidden="true">
                {getLocaleFlag(loc.code)}
              </span>
              <span>{showNative ? loc.nativeName : loc.name}</span>
              {loc.code === locale && (
                <svg className="ml-auto h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Map locale codes to flag emoji */
function getLocaleFlag(locale: Locale): string {
  const flags: Record<Locale, string> = {
    en: "\uD83C\uDDFA\uD83C\uDDF8",
    es: "\uD83C\uDDEA\uD83C\uDDF8",
    fr: "\uD83C\uDDEB\uD83C\uDDF7",
    zh: "\uD83C\uDDE8\uD83C\uDDF3",
    ar: "\uD83C\uDDF8\uD83C\uDDE6",
  };
  return flags[locale] ?? "\uD83C\uDF10";
}

export default LanguageSwitcher;
