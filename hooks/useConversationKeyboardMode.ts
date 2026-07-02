import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
    AndroidSoftInputModes,
    KeyboardController,
} from 'react-native-keyboard-controller';

/**
 * Chat footer is positioned via keyboard-controller Reanimated values.
 * Disable Android window resize on this screen so only our footer animates.
 */
export function useConversationKeyboardMode() {
    useFocusEffect(
        useCallback(() => {
            if (Platform.OS !== 'android') return undefined;

            const apply = () => {
                KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
            };

            apply();

            return () => {
                KeyboardController.setDefaultMode();
            };
        }, []),
    );
}
