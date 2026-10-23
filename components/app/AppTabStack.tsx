import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { menuNavigationScreenListeners } from '@/lib/menuNavigationDiagnostics';

export function AppTabStack() {
    const colors = useColors();
    const { isRTL } = useLanguage();
    return (
        <Stack screenListeners={__DEV__ ? menuNavigationScreenListeners : undefined} screenOptions={{
            headerShown: false,
            headerBackButtonMenuEnabled: false,
            animation: isRTL ? 'slide_from_left' : 'slide_from_right',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            contentStyle: { backgroundColor: colors.brand.bg.primary },
        }} />
    );
}
