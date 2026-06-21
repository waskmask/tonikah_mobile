import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function useHaptics() {
    const lightImpact = useCallback(() => {
        if (Platform.OS === 'web') return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, []);

    const selection = useCallback(() => {
        if (Platform.OS === 'web') return;
        void Haptics.selectionAsync().catch(() => undefined);
    }, []);

    return { lightImpact, selection };
}
