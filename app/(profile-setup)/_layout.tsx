import { useEffect } from 'react';
import { Redirect, Stack, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuthStore } from '@/store/authStore';
import { useProfileSetupStore } from '@/store/profileSetupStore';

export default function ProfileSetupLayout() {
    const { isDark } = useTheme();
    const { isRTL } = useLanguage();
    const segments = useSegments();
    const profile = useAuthStore((state) => state.user?.profile);
    const getIncompleteStep = useProfileSetupStore((state) => state.getIncompleteStep);
    const setGender = useProfileSetupStore((state) => state.setGender);
    const setProfileData = useProfileSetupStore((state) => state.setProfileData);

    useEffect(() => {
        if (!profile) return;
        setGender(profile.gender || '');
        setProfileData(profile);
    }, [profile, setGender, setProfileData]);

    // Step 1 creates immutable basics; it is never an edit screen.
    if (segments[segments.length - 1] === 'step1' && profile) {
        const step = getIncompleteStep(profile);
        return <Redirect href={(step === 0 ? '/search' : `/(profile-setup)/step${Math.max(2, step)}`) as Href} />;
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: isRTL ? 'slide_from_left' : 'slide_from_right',
                contentStyle: {
                    backgroundColor: isDark ? '#101011' : '#FFFFFF',
                },
                gestureEnabled: true,
            }}
        >
            <Stack.Screen name="step1" />
            <Stack.Screen name="step2" options={{ gestureEnabled: false }} />
            <Stack.Screen name="step3" />
            <Stack.Screen name="step4" />
            <Stack.Screen name="step5" />
            <Stack.Screen name="step6" />
            <Stack.Screen name="step7" />
            <Stack.Screen name="step8" />
            <Stack.Screen name="step9" />
            <Stack.Screen name="step10" />
        </Stack>
    );
}
