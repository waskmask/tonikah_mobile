import { useCallback, useRef } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
    AndroidSoftInputModes,
    KeyboardController,
    useKeyboardContext,
} from 'react-native-keyboard-controller';

/**
 * Let the keyboard-controller view own conversation resizing while focused.
 */
export function useConversationKeyboardMode(notificationEntry = '') {
    const { reanimated } = useKeyboardContext();
    const handledEntry = useRef('');
    useFocusEffect(
        useCallback(() => {
            if (Platform.OS !== 'android') return undefined;

            const apply = () => {
                KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
                if (notificationEntry && handledEntry.current !== notificationEntry && AppState.currentState === 'active') {
                    handledEntry.current = notificationEntry;
                    Keyboard.dismiss();
                    void KeyboardController.dismiss({ keepFocus: false, animated: false }).catch(() => undefined);
                    // A resumed notification route must not inherit an invisible keyboard's offsets.
                    reanimated.height.value = 0;
                    reanimated.progress.value = 0;
                }
            };

            apply();
            const subscription = AppState.addEventListener('change', (state) => {
                if (state === 'active') apply();
            });

            return () => {
                subscription.remove();
                KeyboardController.setDefaultMode();
            };
        }, [notificationEntry, reanimated]),
    );
}
