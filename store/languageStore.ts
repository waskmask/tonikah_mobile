import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DevSettings, I18nManager, Image } from "react-native";
import i18n from "i18next";
import { i18nReady } from "@/lib/i18n";
import * as Updates from "expo-updates";
import { markStartup } from "@/lib/performanceDiagnostics";

interface LanguageState {
    currentLanguage: string;
    isRTL: boolean;
    isReady: boolean;
    setLanguage: (lng: string, currentPath?: string) => Promise<void>;
}

/** Route to restore after the language-change reload (reload boots at the initial route). */
export const POST_LANGUAGE_ROUTE_KEY = "tonikah-post-language-route";

const RTL_SYNC_ATTEMPT_KEY = "tonikah-rtl-sync-attempt";
const RTL_SWAP_PREF_APPLIED_KEY = "tonikah-rtl-swap-pref-applied";
const RELOAD_HEART = Image.resolveAssetSource(require("../assets/icon/heart-white.png"));
const RELOAD_SCREEN_OPTIONS = {
    backgroundColor: "#F34B6F",
    image: {
        url: RELOAD_HEART.uri,
        width: 96,
        height: 96,
        scale: 1,
    },
    imageResizeMode: "contain" as const,
    fade: true,
    spinner: { enabled: false },
};

function reloadApp() {
    setTimeout(async () => {
        if (__DEV__) {
            // This native overlay survives the React surface restart, avoiding
            // the blank frame between DevSettings.reload and the new bundle.
            await Updates.showReloadScreen({
                reloadScreenOptions: RELOAD_SCREEN_OPTIONS,
            }).catch(() => { });
            DevSettings.reload();
            return;
        }

        Updates.reloadAsync({
            reloadScreenOptions: RELOAD_SCREEN_OPTIONS,
        }).catch(() => {
            DevSettings.reload();
        });
    }, 120);
}

/**
 * Native RTL state is stored per-install; a rebuild/reinstall wipes it while the
 * persisted language survives. Re-assert it on boot and reload once when the
 * running surface doesn't match the selected language.
 *
 * Also disables Android's left/right swap (literal textAlign/left/right get
 * flipped in RTL; iOS never does this). Fabric reads that flag only when the
 * surface starts, so the first RTL boot after this ships needs one reload too.
 */
async function syncNativeRTL(currentLanguage: string): Promise<boolean> {
    const shouldBeRTL = currentLanguage === "ar";

    // Persists a pref consumed at the next surface start
    I18nManager.swapLeftAndRightInRTL(false);

    let needsReload = I18nManager.isRTL !== shouldBeRTL;

    // Swap pref only affects RTL rendering; force one reload the first time
    // an RTL session runs so the running surface picks it up
    if (!needsReload && shouldBeRTL) {
        const applied = await AsyncStorage.getItem(RTL_SWAP_PREF_APPLIED_KEY).catch(() => null);
        if (!applied) {
            await AsyncStorage.setItem(RTL_SWAP_PREF_APPLIED_KEY, "1").catch(() => { });
            needsReload = true;
        }
    }
    if (!needsReload) return true;

    // One attempt per 15s — if the native flags can't take effect, don't reload-loop
    const last = Number(await AsyncStorage.getItem(RTL_SYNC_ATTEMPT_KEY).catch(() => null)) || 0;
    if (Date.now() - last < 15_000) {
        if (__DEV__) {
            console.warn('[Language] RTL reload cooldown active; continuing to avoid a reload loop.');
        }
        return true;
    }
    await AsyncStorage.setItem(RTL_SYNC_ATTEMPT_KEY, String(Date.now())).catch(() => { });

    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    reloadApp();
    return false;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set, get) => ({
            currentLanguage: i18n.language || "en",
            isRTL: I18nManager.isRTL,
            isReady: false,
            setLanguage: async (lng: string, currentPath?: string) => {
                const previousLanguage = get().currentLanguage;
                if (lng === previousLanguage) return;

                await i18n.changeLanguage(lng);
                await AsyncStorage.setItem("user-language", lng);
                const isRTL = lng === "ar";
                const directionChanged = (previousLanguage === "ar") !== isRTL;

                // Bundled translations can switch in place. A native reload is
                // only needed when entering or leaving RTL layout direction.
                if (!directionChanged) {
                    set({ currentLanguage: lng, isRTL, isReady: true });
                    return;
                }

                if (currentPath) {
                    await AsyncStorage.setItem(POST_LANGUAGE_ROUTE_KEY, currentPath).catch(() => { });
                }
                I18nManager.allowRTL(isRTL);
                I18nManager.forceRTL(isRTL);
                set({ currentLanguage: lng, isRTL, isReady: false });
                reloadApp();
            },
        }),
        {
            name: "tonikah-language-preference",
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ currentLanguage: state.currentLanguage }),
            onRehydrateStorage: () => (state) => {
                void (async () => {
                    try {
                        await i18nReady;
                        // i18n already reads the legacy key; Zustand supplies the persisted preference.
                        const currentLanguage = i18n.language || state?.currentLanguage || 'en';
                        await i18n.changeLanguage(currentLanguage);
                        const canRender = await syncNativeRTL(currentLanguage);
                        if (!canRender) return;
                        useLanguageStore.setState({
                            currentLanguage,
                            isRTL: currentLanguage === 'ar',
                            isReady: true,
                        });
                        markStartup('language-hydrated', { rtl: currentLanguage === 'ar' });
                    } catch (error) {
                        if (__DEV__) console.warn('[Language] Startup synchronization failed:', error);
                        const fallbackLanguage = state?.currentLanguage || 'en';
                        useLanguageStore.setState({
                            currentLanguage: fallbackLanguage,
                            isRTL: fallbackLanguage === 'ar',
                            isReady: true,
                        });
                        markStartup('language-hydrated-fallback', { rtl: fallbackLanguage === 'ar' });
                    }
                })();
            },
        }
    )
);
