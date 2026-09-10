import { useLanguageStore } from '@/store/languageStore';
import i18n from 'i18next';
import { getLanguageName } from '@/lib/languageNames';

export const useLanguage = () => {
    const { currentLanguage, isRTL, isReady, setLanguage } = useLanguageStore();

    return {
        currentLanguage,
        isRTL,
        isReady,
        changeLanguage: setLanguage,
        languageName: getLanguageName(currentLanguage),
        t: i18n.t,
    };
};
