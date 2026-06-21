import { useEffect } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import { useColorScheme } from "nativewind";
import { useThemeStore } from "@/store/themeStore";

/** Keeps NativeWind `dark:` classes aligned with the Zustand theme store. */
export function ThemeSync() {
    const mode = useThemeStore((state) => state.mode);
    const systemScheme = useSystemColorScheme();
    const { setColorScheme } = useColorScheme();

    useEffect(() => {
        const resolved =
            mode === "system"
                ? systemScheme === "dark"
                    ? "dark"
                    : "light"
                : mode;
        setColorScheme(resolved);
    }, [mode, systemScheme, setColorScheme]);

    return null;
}
