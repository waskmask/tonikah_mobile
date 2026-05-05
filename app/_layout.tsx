import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View, LogBox } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    configureReanimatedLogger,
    ReanimatedLogLevel,
} from "react-native-reanimated";

// Suppress Reanimated strict mode warnings (reading shared values during render)
configureReanimatedLogger({
    strict: false,
});

// Suppress expected warnings from dependencies that aren't actionable
LogBox.ignoreLogs([
    'SafeAreaView has been deprecated',
    '[GoogleSignIn] Native module',
    'i18next is maintained with support from Locize',
    'RTL change manual reload required',
]);
import { useFonts } from "expo-font";
import {
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold
} from "@expo-google-fonts/manrope";
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold
} from "@expo-google-fonts/inter";
import {
    NotoSansArabic_400Regular,
    NotoSansArabic_600SemiBold,
    NotoSansArabic_700Bold
} from "@expo-google-fonts/noto-sans-arabic";

import "@/lib/i18n"; // Initialize i18n
import "../global.css";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { configureGoogleSignIn } from "@/lib/googleSignIn";
import { useAuthStore } from "@/store/authStore";
import { ToastProvider } from "@/hooks/useToast";

const queryClient = new QueryClient();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const { restoreSession, isRestoringSession } = useAuthStore();

    const [loaded, error] = useFonts({
        Manrope_500Medium,
        Manrope_600SemiBold,
        Manrope_700Bold,
        Manrope_800ExtraBold,
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        NotoSansArabic_400Regular,
        NotoSansArabic_600SemiBold,
        NotoSansArabic_700Bold,
    });

    useEffect(() => {
        // Run application setup only once
        try {
            configureGoogleSignIn();
        } catch (e) {
            console.warn('[Layout] Google Sign-In configuration skipped:', e);
        }
        restoreSession();
    }, []);

    useEffect(() => {
        if ((loaded || error) && !isRestoringSession) {
            SplashScreen.hideAsync();
        }
    }, [loaded, error, isRestoringSession]);

    // Hold rendering entirely until both fonts are loaded and secure session is checked
    if ((!loaded && !error) || isRestoringSession) {
        return null;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    animation: "fade",
                    contentStyle: {
                        backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                    }
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(profile-setup)" />
                <Stack.Screen name="(tabs)" />
            </Stack>
            <ToastProvider />
        </QueryClientProvider>
    );
}
