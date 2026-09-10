import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, ColorSchemeName } from "react-native";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
    mode: ThemeMode;
    isHydrated: boolean;
    setMode: (mode: ThemeMode) => void;
    setHydrated: (value: boolean) => void;
    toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            mode: "system",
            isHydrated: false,
            setMode: (mode) => set({ mode }),
            setHydrated: (value) => set({ isHydrated: value }),
            toggleMode: () => {
                const { mode } = get();
                if (mode === "light") set({ mode: "dark" });
                else if (mode === "dark") set({ mode: "light" });
                else {
                    // If system, toggle to the opposite of current system theme
                    const systemTheme = Appearance.getColorScheme();
                    set({ mode: systemTheme === "dark" ? "light" : "dark" });
                }
            },
        }),
        {
            name: "tonikah-theme-preference",
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ mode: state.mode }),
            onRehydrateStorage: () => () => {
                useThemeStore.setState({ isHydrated: true });
            },
        }
    )
);
