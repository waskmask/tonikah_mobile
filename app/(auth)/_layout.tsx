import { Stack } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';

export default function AuthLayout() {
    const { isRTL } = useLanguage();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: isRTL ? 'slide_from_left' : 'slide_from_right',
                gestureEnabled: false,
            }}
        >
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="register" />
            <Stack.Screen name="verify-email" />
            <Stack.Screen name="forgot-pass" />
        </Stack>
    );
}
