import { useMemo } from "react";
import { Colors, type ThemePalette } from "@/constants/Colors";
import { useTheme } from "@/hooks/useTheme";

export function useColors(): ThemePalette {
    const { isDark } = useTheme();
    return useMemo(() => Colors[isDark ? "dark" : "light"], [isDark]);
}
