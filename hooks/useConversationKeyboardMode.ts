import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
    AndroidSoftInputModes,
    KeyboardController,
} from 'react-native-keyboard-controller';

/**
 * Keep the conversation in resize mode while it is focused.
 */
export function useConversationKeyboardMode() {
    useFocusEffect(
        useCallback(() => {
            if (Platform.OS !== 'android') return undefined;

            const apply = () => {
                KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_RESIZE);
            };

            apply();

            return () => {
                KeyboardController.setDefaultMode();
            };
        }, []),
    );
}
