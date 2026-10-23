import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { usePathname, useSegments } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppMenuDrawerContent } from '@/components/app/AppMenuDrawer';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { completeInteraction, markInteraction } from '@/lib/performanceDiagnostics';
import { beginMenuNavigation, cancelMenuNavigation, markMenuNavigation } from '@/lib/menuNavigationDiagnostics';

type RootAppMenuContextValue = {
    openMenu: () => void;
    closeMenu: () => void;
};

const RootAppMenuContext = createContext<RootAppMenuContextValue | null>(null);

export function useRootAppMenu() {
    return useContext(RootAppMenuContext);
}

export function RootAppMenuDrawer({ children }: { children: React.ReactNode }) {
    const pendingAction = useRef<{ action: () => void; scope: string; diagnosticId?: number } | null>(null);
    const requestedOpen = useRef(false);
    const drawerVisible = useRef(false);
    const mounted = useRef(true);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { width } = useWindowDimensions();
    const { isRTL, currentLanguage, t } = useLanguage();
    const { isDark } = useTheme();
    const pathname = usePathname();
    const segments = useSegments();
    const accountId = useAuthStore((state) => state.user?._id);
    const canSwipeOpen = Platform.OS === 'android' && Boolean(accountId) && segments[0] === '(tabs)';
    const scope = JSON.stringify([pathname, currentLanguage, isRTL, accountId]);
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const previousScope = useRef(scope);
    const drawerWidth = Math.min(width * 0.86, 360);

    const openMenu = useCallback(() => {
        if (!mounted.current || pendingAction.current || drawerVisible.current) return;
        markInteraction('drawer');
        requestedOpen.current = true;
        drawerVisible.current = true;
        setIsOpen(true);
    }, []);
    const closeMenu = useCallback(() => {
        cancelMenuNavigation(pendingAction.current?.diagnosticId);
        pendingAction.current = null;
        requestedOpen.current = false;
        if (mounted.current) {
            setIsNavigating(false);
            setIsOpen(false);
        }
    }, []);
    const closeThenRun = useCallback((action: () => void, destination?: string) => {
        if (!mounted.current || pendingAction.current) return;
        const diagnosticId = destination ? beginMenuNavigation(destination) : undefined;
        if (!drawerVisible.current) {
            markMenuNavigation(diagnosticId, 'close_ready');
            markMenuNavigation(diagnosticId, 'dispatch');
            action();
            return;
        }
        pendingAction.current = { action, scope: scopeRef.current, diagnosticId };
        requestedOpen.current = false;
        setIsNavigating(true);
        setIsOpen(false);
    }, []);
    const handleClosed = useCallback(() => {
        if (!mounted.current || requestedOpen.current) return;
        drawerVisible.current = false;
        const pending = pendingAction.current;
        pendingAction.current = null;
        setIsNavigating(false);
        if (pending?.scope === scopeRef.current) {
            markMenuNavigation(pending.diagnosticId, 'close_ready');
            markMenuNavigation(pending.diagnosticId, 'dispatch');
            pending.action();
        } else {
            cancelMenuNavigation(pending?.diagnosticId);
        }
    }, []);
    const handleShown = useCallback(() => {
        if (mounted.current && requestedOpen.current) completeInteraction('drawer', 'visible');
    }, []);
    const openGesture = useMemo(() => Gesture.Pan()
        .enabled(canSwipeOpen && !isOpen)
        .hitSlop(isRTL ? { left: 0, width: 28 } : { right: 0, width: 28 })
        .activeOffsetX(isRTL ? 24 : -24)
        .failOffsetY([-24, 24])
        .onEnd((event, success) => {
            if (success && (isRTL ? event.translationX > 24 : event.translationX < -24)) {
                runOnJS(openMenu)();
            }
        }), [canSwipeOpen, isOpen, isRTL, openMenu]);
    const closeGesture = useMemo(() => Gesture.Pan()
        .enabled(Platform.OS === 'android')
        .activeOffsetX(isRTL ? -24 : 24)
        .failOffsetY([-24, 24])
        .onEnd((event, success) => {
            if (success && (isRTL ? event.translationX < -24 : event.translationX > 24)) {
                runOnJS(closeMenu)();
            }
        }), [isRTL, closeMenu]);

    useEffect(() => {
        if (previousScope.current === scope) return;
        previousScope.current = scope;
        closeMenu();
    }, [scope, closeMenu]);

    useEffect(() => {
        // Android Modals have no onDismiss callback. With no dismissal animation,
        // the next frame follows the commit that removes the native window.
        if (Platform.OS === 'ios' || isOpen || !drawerVisible.current) return;
        const frame = requestAnimationFrame(handleClosed);
        return () => cancelAnimationFrame(frame);
    }, [handleClosed, isOpen]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            cancelMenuNavigation(pendingAction.current?.diagnosticId);
            pendingAction.current = null;
        };
    }, []);
    const contextValue = useMemo(() => ({ openMenu, closeMenu }), [openMenu, closeMenu]);

    return (
        <RootAppMenuContext.Provider value={contextValue}>
            <GestureDetector gesture={openGesture}>
                <View collapsable={false} style={styles.root}>{children}</View>
            </GestureDetector>
            <Modal
                visible={isOpen}
                transparent
                animationType={Platform.OS === 'ios' ? 'fade' : 'none'}
                statusBarTranslucent
                navigationBarTranslucent
                hardwareAccelerated
                onRequestClose={closeMenu}
                onDismiss={handleClosed}
                onShow={handleShown}
            >
                {isOpen && (
                    <GestureHandlerRootView style={styles.root}>
                        <SafeAreaProvider>
                            <View style={styles.root}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={String(t('close_menu', 'Close menu'))}
                                    onPress={closeMenu}
                                    style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.58)' : 'rgba(16,16,17,0.45)' }]}
                                />
                                <GestureDetector gesture={closeGesture}>
                                    <View collapsable={false} style={[styles.panel, { width: drawerWidth, [isRTL ? 'left' : 'right']: 0 }]}>
                                        <AppMenuDrawerContent onClose={closeMenu} onCloseThenRun={closeThenRun} isNavigating={isNavigating} />
                                    </View>
                                </GestureDetector>
                            </View>
                        </SafeAreaProvider>
                    </GestureHandlerRootView>
                )}
            </Modal>
        </RootAppMenuContext.Provider>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    panel: { position: 'absolute', top: 0, bottom: 0 },
});
