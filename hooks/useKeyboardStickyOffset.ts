import { useMemo } from 'react';

type KeyboardStickyOffset = {
    closed: number;
    opened: number;
};

/** Zero offsets — safe area is handled by ChatKeyboardFooter / KeyboardSafeAreaSpacer. */
export function useKeyboardStickyOffset(): KeyboardStickyOffset {
    return useMemo(
        () => ({
            closed: 0,
            opened: 0,
        }),
        [],
    );
}
