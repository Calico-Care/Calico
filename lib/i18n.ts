import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import es from '@/locales/es.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
};

function resolveInitialLanguage(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module
    const localization = require('expo-localization') as {
      getLocales?: () => Array<{ languageCode?: string | null }>;
    };
    if (typeof localization?.getLocales === 'function') {
      const locales = localization.getLocales();
      return locales?.[0]?.languageCode ?? 'en';
    }
  } catch {
    // fall through to default language
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
export { useTranslation } from 'react-i18next';
