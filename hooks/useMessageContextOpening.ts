import { useEffect, useMemo } from 'react';
import { AppState, Keyboard, Platform, TextInput } from 'react-native';
import { KeyboardController, KeyboardEvents } from 'react-native-keyboard-controller';
import { createMessageContextOpening } from '@/lib/messageContextOpening';

export function useMessageContextOpening(conversationId: string, focused: boolean) {
    const opening = useMemo(() => createMessageContextOpening({
        ios: Platform.OS === 'ios',
        keyboardVisible: () => KeyboardController.isVisible() || Keyboard.isVisible(),
        inputFocused: () => TextInput.State.currentlyFocusedInput() !== null,
        dismissKeyboard: () => Keyboard.dismiss(),
        onKeyboardHidden: (ready) => {
            const controller = KeyboardEvents.addListener('keyboardDidHide', ready);
            const native = Keyboard.addListener('keyboardDidHide', ready);
            return () => { controller.remove(); native.remove(); };
        },
        nextFrame: (ready) => {
            const frame = requestAnimationFrame(ready);
            return () => cancelAnimationFrame(frame);
        },
        deadline: (ready) => {
            const timer = setTimeout(ready, 1500);
            return () => clearTimeout(timer);
        },
    }), []);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state !== 'active') opening.cancel();
        });
        return () => { subscription.remove(); opening.cancel(); };
    }, [conversationId, focused, opening]);

    return opening;
}
