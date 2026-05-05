import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function ProfileSetupLayout() {
    const { isDark } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: {
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                },
                gestureEnabled: true,
            }}
        >
            <Stack.Screen name="step1" />
            <Stack.Screen name="step2" />
            <Stack.Screen name="step3" />
            <Stack.Screen name="step4" />
            <Stack.Screen name="step5" />
            <Stack.Screen name="step6" />
            <Stack.Screen name="step7" />
            <Stack.Screen name="step8" />
            <Stack.Screen name="step9" />
        </Stack>
    );
}
