import { useTranslation } from 'react-i18next';

/**
 * Custom hook for internationalization
 *
 * Usage:
 * const { t, changeLanguage, currentLanguage } = useI18n();
 *
 * <Text>{t('common.welcome')}</Text>
 * <Button onPress={() => changeLanguage('es')}>Español</Button>
 */
export function useI18n() {
  const { t, i18n } = useTranslation();

  return {
    t,
    changeLanguage: (lng: string) => i18n.changeLanguage(lng),
    currentLanguage: i18n.language,
    languages: ['en', 'es'] as const,
  };
}
