import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { View, LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
    '[GoogleSignIn] Native module',
    'i18next is maintained with support from Locize',
    'RTL change manual reload required',
]);
import { useFonts } from "expo-font";
import {
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold
} from "@expo-google-fonts/plus-jakarta-sans";
import {
    NotoSansArabic_400Regular,
    NotoSansArabic_600SemiBold,
    NotoSansArabic_700Bold
} from "@expo-google-fonts/noto-sans-arabic";

import "@/lib/i18n"; // Initialize i18n
import "../global.css";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { configureGoogleSignIn } from "@/lib/googleSignIn";
import { useAuthStore } from "@/store/authStore";
import { ToastProvider } from "@/hooks/useToast";
import { useToast } from "@/hooks/useToast";
import { addPushNotificationListeners } from "@/lib/pushNotifications";
import { ThemeSync } from "@/components/app/ThemeSync";
import { AppLoadingScreen } from "@/components/app/AppLoadingScreen";

const queryClient = new QueryClient();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();
// Cross-fade the native splash into the app instead of a hard cut
SplashScreen.setOptions({ fade: true, duration: 400 });

export default function RootLayout() {
    const { isDark } = useTheme();
    const colors = useColors();
    const { isRTL } = useLanguage();
    const { restoreSession, isRestoringSession } = useAuthStore();
    const toast = useToast();

    const [loaded, error] = useFonts({
        PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold,
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

    useEffect(() => {
        if ((!loaded && !error) || isRestoringSession) return;

        try {
            return addPushNotificationListeners((message) => {
                toast.show(message, 'info', 5000);
            });
        } catch (error) {
            console.warn('[Layout] Push notification listeners skipped:', error);
            return undefined;
        }
    }, [toast, loaded, error, isRestoringSession]);

    // Hold app rendering until fonts are loaded and secure session is checked.
    // Providers must stay mounted through the loading phase — swapping the whole
    // tree breaks react-native-keyboard-controller's handler registration.
    const showLoading = (!loaded && !error) || isRestoringSession;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
        {showLoading ? (
            <AppLoadingScreen />
        ) : (
        <SafeAreaProvider>
            <ThemeSync />
            <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                backgroundColor={colors.brand.bg.primary}
            />
            <QueryClientProvider client={queryClient}>
                <BottomSheetModalProvider>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        // Pushed detail screens (conversation, user, support) slide and support swipe-back
                        animation: isRTL ? "slide_from_left" : "slide_from_right",
                        gestureEnabled: true,
                        fullScreenGestureEnabled: true,
                        contentStyle: {
                            backgroundColor: colors.brand.bg.primary,
                        }
                    }}
                >
                    {/* Auth-state group swaps: fade, no swipe-back (never back into auth/onboarding) */}
                    <Stack.Screen name="index" options={{ animation: "fade", gestureEnabled: false }} />
                    <Stack.Screen name="(onboarding)" options={{ animation: "fade", gestureEnabled: false }} />
                    <Stack.Screen name="(auth)" options={{ animation: "fade", gestureEnabled: false }} />
                    <Stack.Screen name="(profile-setup)" options={{ animation: "fade", gestureEnabled: false }} />
                    <Stack.Screen name="(tabs)" options={{ animation: "fade", gestureEnabled: false }} />
                </Stack>
                <ToastProvider />
                </BottomSheetModalProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
        )}
        </KeyboardProvider>
        </GestureHandlerRootView>
    );
}
