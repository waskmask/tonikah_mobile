import { useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useConnectivity } from '@/hooks/useConnectivity';
import { scale } from '@/hooks/useResponsive';
import { connectivity } from '@/lib/connectivity';
import { t } from '@/lib/profileDisplay';
import { useAuthStore } from '@/store/authStore';

export function ConnectivityMonitor() {
    const { status, isOffline } = useConnectivity();
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const previousStatusRef = useRef(status);

    useEffect(() => {
        void connectivity.check();
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') void connectivity.check();
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (status === 'unknown') return;
        const previous = previousStatusRef.current;
        previousStatusRef.current = status;
        onlineManager.setOnline(status === 'online');
        if (previous === 'offline' && status === 'online') {
            void refreshUser();
            void queryClient.refetchQueries({ type: 'active' });
        }
    }, [queryClient, refreshUser, status]);

    useEffect(() => {
        if (!isOffline) return;
        const intervalId = setInterval(() => {
            if (AppState.currentState === 'active') void connectivity.check();
        }, 6000);
        return () => clearInterval(intervalId);
    }, [isOffline]);

    if (!isOffline) return null;

    return (
        <View
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            style={[styles.banner, { top: insets.top, backgroundColor: colors.chrome.common.textStrong }]}
        >
            <WifiOff size={scale(13)} color={colors.chrome.common.inverseText} strokeWidth={2.4} />
            <Text variant="caption" className="font-body-bold" style={{ color: colors.chrome.common.inverseText }}>
                {t('chat:offline', 'Offline')}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        left: scale(12),
        right: scale(12),
        zIndex: 1000,
        minHeight: scale(27),
        borderRadius: scale(6),
        paddingHorizontal: scale(10),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(6),
    },
});
