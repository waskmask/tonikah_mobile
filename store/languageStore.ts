import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";
import i18n from "i18next";
import * as Updates from "expo-updates";

interface LanguageState {
    currentLanguage: string;
    isRTL: boolean;
    setLanguage: (lng: string) => Promise<void>;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            currentLanguage: i18n.language || "en",
            isRTL: I18nManager.isRTL,
            setLanguage: async (lng: string) => {
                await i18n.changeLanguage(lng);
                await AsyncStorage.setItem("user-language", lng);

                const isRTL = lng === "ar";

                if (isRTL !== I18nManager.isRTL) {
                    I18nManager.allowRTL(isRTL);
                    I18nManager.forceRTL(isRTL);

                    // Force reload to apply RTL changes
                    setTimeout(() => {
                        Updates.reloadAsync().catch(() => {
                            // Fallback if Updates is not available in dev
                            console.warn("RTL change manual reload required");
                        });
                    }, 100);
                }

                set({ currentLanguage: lng, isRTL });
            },
        }),
        {
            name: "tonikah-language-preference",
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
