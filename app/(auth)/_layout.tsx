import { Stack, router, useSegments } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';

export default function AuthLayout() {
    const { isAuthenticated, isRestoringSession } = useAuthStore();
    const { isRTL } = useLanguage();
    const segments = useSegments();

    useEffect(() => {
        const currentRoute = segments[segments.length - 1];
        if (!isRestoringSession && isAuthenticated && currentRoute !== 'verify-email' && currentRoute !== 'signup') {
            router.replace('/');
        }
    }, [isAuthenticated, isRestoringSession, segments]);

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: isRTL ? 'slide_from_left' : 'slide_from_right',
            }}
        >
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="verify-email" />
            <Stack.Screen name="forgot-pass" />
        </Stack>
    );
}
