import { useLanguageStore } from "@/store/languageStore";
import i18n from "i18next";

export const useLanguage = () => {
    const { currentLanguage, isRTL, setLanguage } = useLanguageStore();

    const getLanguageName = (lng: string) => {
        const names: Record<string, string> = {
            en: "English",
            ar: "العربية",
            de: "Deutsch",
            es: "Español",
            fr: "Français",
            id: "Bahasa Indonesia",
            it: "Italiano",
            pl: "Polski",
            pt: "Português",
            ru: "Русский",
            tr: "Türkçe",
        };
        return names[lng] || lng;
    };

    return {
        currentLanguage,
        isRTL,
        changeLanguage: setLanguage,
        languageName: getLanguageName(currentLanguage),
        t: i18n.t,
    };
};
