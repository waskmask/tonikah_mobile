import { Stack, router, useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { AppState, View, LogBox, Platform, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
    focusManager,
    QueryClientProvider,
} from "@tanstack/react-query";
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
    'RTL change manual reload required',
    '[RN-IAP] Failed to initialize IAP connection',
]);
import { getLoadedFonts, useFonts } from "expo-font";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { POST_LANGUAGE_ROUTE_KEY } from "@/store/languageStore";
import { useAuthStore } from "@/store/authStore";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import { ToastProvider } from "@/hooks/useToast";
import { useToast } from "@/hooks/useToast";
import { addPushNotificationListeners, registerForPushNotifications } from "@/lib/pushNotifications";
import { ThemeSync } from "@/components/app/ThemeSync";
import { AppLoadingScreen } from "@/components/app/AppLoadingScreen";
import { GalleryEligibilityListener } from "@/components/app/GalleryEligibilityListener";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { ConnectivityMonitor } from "@/components/app/ConnectivityMonitor";
import { LegalConsentGate } from "@/components/app/LegalConsentGate";
import { EmailVerificationGate } from "@/components/app/EmailVerificationGate";
import { firstSearchParam, sanitizeAuthReturnPath } from "@/lib/authReturn";
import { RootAppMenuDrawer } from "@/components/app/RootAppMenuDrawer";
import { markStartup } from "@/lib/performanceDiagnostics";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();
// Cross-fade the native splash into the app instead of a hard cut
SplashScreen.setOptions({ fade: true, duration: 120 });
markStartup('root-module-evaluated');

function StartupNavigatorMarker() {
    useEffect(() => {
        markStartup('navigator-committed');
    }, []);
    return null;
}

export default function RootLayout() {
    const { isDark, isReady: isThemeReady } = useTheme();
    const colors = useColors();
    const { isRTL, isReady: isLanguageReady } = useLanguage();
    const { restoreSession, refreshUser, handleUnauthorized, isRestoringSession, isAuthenticated, user } = useAuthStore();
    const getIncompleteStep = useProfileSetupStore((state) => state.getIncompleteStep);
    const segments = useSegments();
    const pathname = usePathname();
    const authParams = useGlobalSearchParams<{ returnTo?: string | string[] }>();
    const toast = useToast();
    const [nonVisualServicesReady, setNonVisualServicesReady] = useState(false);
    const embeddedFontName = Platform.OS === "ios"
        ? "PlusJakartaSans-Regular"
        : "PlusJakartaSans_400Regular";
    const hasEmbeddedNativeFonts = Platform.OS !== "web" && getLoadedFonts().includes(embeddedFontName);

    const [loaded, error] = useFonts(Platform.OS === "web" || !hasEmbeddedNativeFonts ? {
        PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold,
        NotoSansArabic_400Regular,
        NotoSansArabic_600SemiBold,
        NotoSansArabic_700Bold,
    } : {});
    const startupReady = (loaded || Boolean(error))
        && !isRestoringSession
        && isLanguageReady
        && isThemeReady;

    useEffect(() => {
        return api.setUnauthorizedHandler(async (details) => {
            await handleUnauthorized(details);
            queryClient.clear();
            if (details?.message === 'account_suspended') {
                router.replace('/account-suspended');
            } else {
                router.replace('/(auth)/login');
            }
        });
    }, [handleUnauthorized]);

    // This is the single owner of redirects caused by authentication state.
    // Workflow navigation (signup steps, language restoration) stays local.
    useEffect(() => {
        if (isRestoringSession || !isLanguageReady) return;

        const rootSegment = segments[0];
        const currentRoute = segments[segments.length - 1];
        const isAuthRoute = rootSegment === '(auth)';
        const isPublicRoute = !rootSegment || isAuthRoute || rootSegment === '(onboarding)' || currentRoute === 'account-suspended';
        const isProfileSetupRoute = rootSegment === '(profile-setup)';
        const isAuthContinuation = currentRoute === 'signup' || currentRoute === 'verify-email';

        if (!isAuthenticated && !isPublicRoute) {
            const returnTo = sanitizeAuthReturnPath(pathname);
            router.replace({
                pathname: '/(auth)/login',
                params: returnTo ? { returnTo } : {},
            });
            return;
        }

        if (isAuthenticated && !isPublicRoute && !isProfileSetupRoute) {
            const incompleteStep = user?.profile ? getIncompleteStep(user.profile) : 1;
            if (incompleteStep > 0) {
                router.replace(`/(profile-setup)/step${incompleteStep}` as any);
                return;
            }
        }

        if (isAuthenticated && isAuthRoute && !isAuthContinuation) {
            const returnTo = sanitizeAuthReturnPath(firstSearchParam(authParams.returnTo));
            router.replace({
                pathname: '/',
                params: returnTo ? { returnTo } : {},
            });
        }
    }, [authParams.returnTo, getIncompleteStep, isAuthenticated, isLanguageReady, isRestoringSession, pathname, segments, user?.profile]);

    useEffect(() => {
        const previousState = { current: AppState.currentState };
        focusManager.setFocused(AppState.currentState === 'active');
        const subscription = AppState.addEventListener('change', (state) => {
            focusManager.setFocused(state === 'active');
            if (state === 'active' && previousState.current !== 'active' && useAuthStore.getState().isAuthenticated) {
                void useAuthStore.getState().refreshUser();
            }
            previousState.current = state;
        });
        return () => subscription.remove();
    }, []);

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
        if (loaded || error) markStartup('fonts-ready', { fallback: Boolean(error) });
        if (isThemeReady) markStartup('theme-ready');
        if (isLanguageReady) markStartup('language-ready', { rtl: isRTL });
        if (!isRestoringSession) markStartup('auth-ready', { authenticated: isAuthenticated });
    }, [error, isAuthenticated, isLanguageReady, isRestoringSession, isRTL, isThemeReady, loaded]);

    useEffect(() => {
        if (!startupReady) return;
        markStartup('startup-gates-ready');
        void SplashScreen.hideAsync()
            .then(() => markStartup('native-splash-hidden'))
            .catch(() => undefined);
    }, [startupReady]);

    useEffect(() => {
        if (!startupReady) {
            setNonVisualServicesReady(false);
            return;
        }

        const timeoutId = setTimeout(() => {
            setNonVisualServicesReady(true);
            markStartup('deferred-services-started');
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [startupReady]);

    // Language change reloads the app (RTL needs it) and boots at the initial
    // route — restore where the user actually was (e.g. signup, language page).
    useEffect(() => {
        if ((!loaded && !error) || isRestoringSession || !isLanguageReady) return;
        let cancelled = false;
        (async () => {
            const path = await AsyncStorage.getItem(POST_LANGUAGE_ROUTE_KEY).catch(() => null);
            if (!path) return;
            await AsyncStorage.removeItem(POST_LANGUAGE_ROUTE_KEY).catch(() => { });
            if (cancelled) return;
            const isPublicPath = path === '/'
                || path.startsWith('/(auth)')
                || path.startsWith('/(onboarding)');
            if (!isAuthenticated && !isPublicPath) return;
            // Let the initial route settle first, then jump back
            setTimeout(() => {
                try {
                    router.replace(path as any);
                } catch {
                    // Route no longer valid — stay on the default route
                }
            }, 50);
        })();
        return () => {
            cancelled = true;
        };
    }, [loaded, error, isAuthenticated, isLanguageReady, isRestoringSession]);

    useEffect(() => {
        if (!nonVisualServicesReady) return;

        try {
            return addPushNotificationListeners((message) => {
                toast.show(message, 'info', 5000);
            });
        } catch (error) {
            console.warn('[Layout] Push notification listeners skipped:', error);
            return undefined;
        }
    }, [nonVisualServicesReady, toast]);

    useEffect(() => {
        if (!nonVisualServicesReady || !isAuthenticated) return;
        markStartup('background-user-refresh-start');
        void refreshUser()
            .catch(() => undefined)
            .finally(() => markStartup('background-user-refresh-finished'));
        void registerForPushNotifications().catch(() => undefined);
    }, [isAuthenticated, nonVisualServicesReady, refreshUser]);

    // Hold app rendering until fonts are loaded and secure session is checked.
    // Providers must stay mounted through the loading phase — swapping the whole
    // tree breaks react-native-keyboard-controller's handler registration.
    const showLoading = !startupReady;

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
                // Warm chrome surface, same as the headers (unified app-wide)
                backgroundColor={colors.chrome.header.background}
            />
            <QueryClientProvider client={queryClient}>
                {nonVisualServicesReady ? <ConnectivityMonitor /> : null}
                {nonVisualServicesReady ? <GalleryEligibilityListener /> : null}
                <BottomSheetModalProvider>
                <LegalConsentGate />
                <EmailVerificationGate />
                <RootAppMenuDrawer>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        headerBackButtonMenuEnabled: false,
                        // Pushed detail screens such as conversations and profiles support swipe-back.
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
                    <Stack.Screen name="(tabs)" options={{ animation: "none", gestureEnabled: false }} />
                    <Stack.Screen
                        name="edit-profile"
                        options={{
                            animation: isRTL ? "slide_from_left" : "slide_from_right",
                            gestureEnabled: true,
                            fullScreenGestureEnabled: true,
                        }}
                    />
                </Stack>
                <StartupNavigatorMarker />
                </RootAppMenuDrawer>
                <ToastProvider />
                </BottomSheetModalProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
        )}
        </KeyboardProvider>
        </GestureHandlerRootView>
    );
}
