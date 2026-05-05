import { Stack, router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';

export default function AuthLayout() {
    const { isAuthenticated, user, isRestoringSession } = useAuthStore();
    const { isRTL } = useLanguage();

    useEffect(() => {
        // If not restoring session, and user IS authenticated AND verified, redirect to tabs
        // If they are authenticated but NOT verified, we let them stay here so they can see the verify-email screen
        if (!isRestoringSession && isAuthenticated && user?.email_verified) {
            router.replace('/');
        }
    }, [isAuthenticated, user, isRestoringSession]);

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
        </Stack>
    );
}
