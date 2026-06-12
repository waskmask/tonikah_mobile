import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DevSettings, I18nManager } from "react-native";
import i18n from "i18next";
import * as Updates from "expo-updates";

interface LanguageState {
    currentLanguage: string;
    isRTL: boolean;
    setLanguage: (lng: string) => Promise<void>;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set, get) => ({
            currentLanguage: i18n.language || "en",
            isRTL: I18nManager.isRTL,
            setLanguage: async (lng: string) => {
                const previousLanguage = get().currentLanguage;
                if (lng === previousLanguage) return;

                await i18n.changeLanguage(lng);
                await AsyncStorage.setItem("user-language", lng);

                const isRTL = lng === "ar";

                if (isRTL !== I18nManager.isRTL) {
                    I18nManager.allowRTL(isRTL);
                    I18nManager.forceRTL(isRTL);

                }

                set({ currentLanguage: lng, isRTL });
                setTimeout(() => {
                    Updates.reloadAsync().catch(() => {
                        DevSettings.reload();
                    });
                }, 120);
            },
        }),
        {
            name: "tonikah-language-preference",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
