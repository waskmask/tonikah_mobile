import { useEffect } from "react";
import { useColorScheme } from "nativewind";
import { useThemeStore } from "@/store/themeStore";

/** Keeps NativeWind `dark:` classes aligned with the Zustand theme store. */
export function ThemeSync() {
    const mode = useThemeStore((state) => state.mode);
    const { setColorScheme } = useColorScheme();

    useEffect(() => {
        // Passing "system" removes the previous app override and lets the OS
        // appearance drive both NativeWind and React Native color-scheme hooks.
        setColorScheme(mode);
    }, [mode, setColorScheme]);

    return null;
}
