# Internationalization (i18n)

## Supported Languages
en (default), es, fr, zh, ar (RTL)

## Adding a Language
1. Create `src/i18n/locales/{code}.json`
2. Copy from `en.json` and translate
3. Add to language selector
4. Test RTL if applicable

## Usage
```tsx
const { t } = useTranslation();
return <h1>{t('deposit.title')}</h1>;
```

## Guidelines
- Never hardcode user-facing strings
- Use interpolation for dynamic values
- Have native speakers review translations
