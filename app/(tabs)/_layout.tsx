import { useCallback, useEffect, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Drawer, useDrawerProgress, useDrawerStatus } from 'expo-router/drawer';
import { runOnJS, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { AppMenuDrawerContent } from '@/components/app/AppMenuDrawer';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { completeInteraction } from '@/lib/performanceDiagnostics';

function TabsMenuContent({ closeDrawer }: { closeDrawer: () => void }) {
    const pendingAction = useRef<(() => void) | null>(null);
    const queued = useSharedValue(false);
    const progress = useDrawerProgress();
    const isOpen = useDrawerStatus() === 'open';
    const finishClose = useCallback(() => {
        const action = pendingAction.current;
        pendingAction.current = null;
        action?.();
    }, []);
    useEffect(() => () => { pendingAction.current = null; }, []);
    useAnimatedReaction(
        () => queued.value && progress.value === 0,
        (closed) => {
            if (!closed) return;
            queued.value = false;
            runOnJS(finishClose)();
        },
        [finishClose],
    );
    useAnimatedReaction(
        () => progress.value === 1,
        (opened, previous) => {
            if (opened && !previous) runOnJS(completeInteraction)('drawer', 'visible');
        },
    );
    return <AppMenuDrawerContent onClose={closeDrawer} isOpen={isOpen}
        onCloseThenRun={(action) => {
            if (pendingAction.current) return;
            pendingAction.current = action;
            closeDrawer();
            queued.value = true;
        }} />;
}

export default function TabsDrawerLayout() {
    const { width } = useWindowDimensions();
    const { isRTL, t } = useLanguage();
    const { isDark } = useTheme();
    const drawerWidth = Math.min(width * 0.86, 360);

    return (
        <Drawer
            backBehavior="history"
            drawerContent={({ navigation }) => (
                <TabsMenuContent closeDrawer={() => navigation.closeDrawer()} />
            )}
            screenOptions={{
                headerShown: false,
                drawerPosition: isRTL ? 'left' : 'right',
                drawerType: 'front',
                drawerStyle: {
                    width: drawerWidth,
                    backgroundColor: 'transparent',
                },
                overlayColor: isDark ? 'rgba(0,0,0,0.58)' : 'rgba(16,16,17,0.45)',
                swipeEnabled: Platform.OS !== 'ios',
                swipeEdgeWidth: 28,
                swipeMinDistance: 24,
            }}
        >
            <Drawer.Screen
                name="(main)"
                options={{
                    title: String(t('menu') || 'Menu'),
                    drawerItemStyle: { display: 'none' },
                }}
            />
        </Drawer>
    );
}
