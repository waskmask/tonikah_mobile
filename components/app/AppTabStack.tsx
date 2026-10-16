import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';

export function AppTabStack() {
    const colors = useColors();
    const { isRTL } = useLanguage();
    return (
        <Stack screenOptions={{
            headerShown: false,
            headerBackButtonMenuEnabled: false,
            animation: isRTL ? 'slide_from_left' : 'slide_from_right',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            contentStyle: { backgroundColor: colors.brand.bg.primary },
        }} />
    );
}
