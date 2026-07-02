import { useMemo } from 'react';
import { useKeyboardState } from 'react-native-keyboard-controller';

type KeyboardHeightState = {
    visible: boolean;
    height: number;
};

/**
 * Tracks keyboard visibility and height using react-native-keyboard-controller
 * for consistent Android/iOS measurements (including modals).
 */
export function useKeyboardHeight(): KeyboardHeightState {
    const isVisible = useKeyboardState((state) => state.isVisible);
    const height = useKeyboardState((state) => state.height);

    return useMemo(
        () => ({
            visible: isVisible,
            height,
        }),
        [isVisible, height],
    );
}
