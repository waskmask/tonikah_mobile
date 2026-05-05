import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "nativewind";
import { storage } from "@/lib/storage";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
    const [theme, setThemeState] = useState<Theme>((colorScheme as Theme) || "light");

    useEffect(() => {
        // Load persisted theme
        const loadTheme = async () => {
            const persistedTheme = await storage.getItem("theme-preference");
            if (persistedTheme) {
                setThemeState(persistedTheme);
                setColorScheme(persistedTheme);
            }
        };
        loadTheme();
    }, []);

    const setTheme = async (newTheme: Theme) => {
        setThemeState(newTheme);
        setColorScheme(newTheme);
        await storage.setItem("theme-preference", newTheme);
    };

    const toggleTheme = async () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
    };

    return (
        <ThemeContext.Provider
            value={{
                theme,
                toggleTheme,
                setTheme,
                isDark: theme === "dark",
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
};
