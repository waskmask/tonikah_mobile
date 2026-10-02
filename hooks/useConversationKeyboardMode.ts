import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
    AndroidSoftInputModes,
    KeyboardController,
} from 'react-native-keyboard-controller';

/**
 * Let the keyboard-controller view own conversation resizing while focused.
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
