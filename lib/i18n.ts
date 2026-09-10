import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { I18nManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// All namespaces used across the app
const NAMESPACES = ["common", "chat", "countries", "nationalities", "designations", "ethnic_group", "ethnic_groups", "languages"] as const;

// Supported languages: ar, de, en, es, fr, id, it, pl, pt, ru, tr
const RESOURCES = {
    en: {
        common: require("../locales/en/common.json"),
        chat: require("../locales/en/chat.json"),
        countries: require("../locales/en/countries.json"),
        nationalities: require("../locales/en/nationalities.json"),
        designations: require("../locales/en/designations.json"),
        ethnic_group: require("../locales/en/ethnic_group.json"),
        ethnic_groups: require("../locales/en/ethnic_groups.json"),
        languages: require("../locales/en/languages.json"),
    },
    ar: {
        common: require("../locales/ar/common.json"),
        chat: require("../locales/ar/chat.json"),
        countries: require("../locales/ar/countries.json"),
        nationalities: require("../locales/ar/nationalities.json"),
        designations: require("../locales/ar/designations.json"),
        ethnic_group: require("../locales/ar/ethnic_group.json"),
        ethnic_groups: require("../locales/ar/ethnic_groups.json"),
        languages: require("../locales/ar/languages.json"),
    },
    de: {
        common: require("../locales/de/common.json"),
        chat: require("../locales/de/chat.json"),
        countries: require("../locales/de/countries.json"),
        nationalities: require("../locales/de/nationalities.json"),
        designations: require("../locales/de/designations.json"),
        ethnic_group: require("../locales/de/ethnic_group.json"),
        ethnic_groups: require("../locales/de/ethnic_groups.json"),
        languages: require("../locales/de/languages.json"),
    },
    es: {
        common: require("../locales/es/common.json"),
        chat: require("../locales/es/chat.json"),
        countries: require("../locales/es/countries.json"),
        nationalities: require("../locales/es/nationalities.json"),
        designations: require("../locales/es/designations.json"),
        ethnic_group: require("../locales/es/ethnic_group.json"),
        ethnic_groups: require("../locales/es/ethnic_groups.json"),
        languages: require("../locales/es/languages.json"),
    },
    fr: {
        common: require("../locales/fr/common.json"),
        chat: require("../locales/fr/chat.json"),
        countries: require("../locales/fr/countries.json"),
        nationalities: require("../locales/fr/nationalities.json"),
        designations: require("../locales/fr/designations.json"),
        ethnic_group: require("../locales/fr/ethnic_group.json"),
        ethnic_groups: require("../locales/fr/ethnic_groups.json"),
        languages: require("../locales/fr/languages.json"),
    },
    id: {
        common: require("../locales/id/common.json"),
        chat: require("../locales/id/chat.json"),
        countries: require("../locales/id/countries.json"),
        nationalities: require("../locales/id/nationalities.json"),
        designations: require("../locales/id/designations.json"),
        ethnic_group: require("../locales/id/ethnic_group.json"),
        ethnic_groups: require("../locales/id/ethnic_groups.json"),
        languages: require("../locales/id/languages.json"),
    },
    it: {
        common: require("../locales/it/common.json"),
        chat: require("../locales/it/chat.json"),
        countries: require("../locales/it/countries.json"),
        nationalities: require("../locales/it/nationalities.json"),
        designations: require("../locales/it/designations.json"),
        ethnic_group: require("../locales/it/ethnic_group.json"),
        ethnic_groups: require("../locales/it/ethnic_groups.json"),
        languages: require("../locales/it/languages.json"),
    },
    pl: {
        common: require("../locales/pl/common.json"),
        chat: require("../locales/pl/chat.json"),
        countries: require("../locales/pl/countries.json"),
        nationalities: require("../locales/pl/nationalities.json"),
        designations: require("../locales/pl/designations.json"),
        ethnic_group: require("../locales/pl/ethnic_group.json"),
        ethnic_groups: require("../locales/pl/ethnic_groups.json"),
        languages: require("../locales/pl/languages.json"),
    },
    pt: {
        common: require("../locales/pt/common.json"),
        chat: require("../locales/pt/chat.json"),
        countries: require("../locales/pt/countries.json"),
        nationalities: require("../locales/pt/nationalities.json"),
        designations: require("../locales/pt/designations.json"),
        ethnic_group: require("../locales/pt/ethnic_group.json"),
        ethnic_groups: require("../locales/pt/ethnic_groups.json"),
        languages: require("../locales/pt/languages.json"),
    },
    ru: {
        common: require("../locales/ru/common.json"),
        chat: require("../locales/ru/chat.json"),
        countries: require("../locales/ru/countries.json"),
        nationalities: require("../locales/ru/nationalities.json"),
        designations: require("../locales/ru/designations.json"),
        ethnic_group: require("../locales/ru/ethnic_group.json"),
        ethnic_groups: require("../locales/ru/ethnic_groups.json"),
        languages: require("../locales/ru/languages.json"),
    },
    tr: {
        common: require("../locales/tr/common.json"),
        chat: require("../locales/tr/chat.json"),
        countries: require("../locales/tr/countries.json"),
        nationalities: require("../locales/tr/nationalities.json"),
        designations: require("../locales/tr/designations.json"),
        ethnic_group: require("../locales/tr/ethnic_group.json"),
        ethnic_groups: require("../locales/tr/ethnic_groups.json"),
        languages: require("../locales/tr/languages.json"),
    },
};

const initI18n = async () => {
    // Try to load saved language
    let savedLanguage = await AsyncStorage.getItem("user-language").catch(() => null);

    // Detect device language
    const locales = Localization.getLocales();
    const deviceLanguage = locales[0]?.languageCode || "en";

    const lng = savedLanguage || (RESOURCES[deviceLanguage as keyof typeof RESOURCES] ? deviceLanguage : "en");

    // Critical: Set RTL if necessary before init (Only Arabic in this set)
    const isRTL = lng === "ar";
    if (isRTL !== I18nManager.isRTL) {
        I18nManager.allowRTL(isRTL);
        I18nManager.forceRTL(isRTL);
    }

    await i18n.use(initReactI18next).init({
        resources: RESOURCES,
        lng,
        fallbackLng: "en",
        ns: NAMESPACES as unknown as string[],
        defaultNS: "common",
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });
};

export const i18nReady = initI18n();

export default i18n;
