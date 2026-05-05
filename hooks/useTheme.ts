import { useThemeStore } from "@/store/themeStore";
import { useColorScheme } from "react-native";

export const useTheme = () => {
    const { mode, setMode, toggleMode } = useThemeStore();
    const systemColorScheme = useColorScheme();

    // Compute isDark based on mode and system preference
    const isDark =
        mode === "dark"
            ? true
            : mode === "light"
                ? false
                : systemColorScheme === "dark";

    return {
        theme: mode,
        isDark,
        toggleTheme: toggleMode,
        setTheme: setMode,
    };
};
