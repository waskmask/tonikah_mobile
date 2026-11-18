import type { MessageAnchor } from './messageContextLayout';

export type MeasureMessageAnchor = (ready: (anchor: MessageAnchor) => void) => void;

type OpeningEnvironment = {
    ios: boolean;
    keyboardVisible: () => boolean;
    inputFocused: () => boolean;
    dismissKeyboard: () => void;
    onKeyboardHidden: (ready: () => void) => () => void;
    nextFrame: (ready: () => void) => () => void;
    deadline: (ready: () => void) => () => void;
};

/** Coordinate one screen's long presses without changing composer positioning. */
export function createMessageContextOpening(env: OpeningEnvironment) {
    let generation = 0;
    let removeHideListener: (() => void) | undefined;
    let cancelFrame: (() => void) | undefined;
    let cancelDeadline: (() => void) | undefined;

    const cleanup = () => {
        removeHideListener?.();
        cancelFrame?.();
        cancelDeadline?.();
        removeHideListener = cancelFrame = cancelDeadline = undefined;
    };
    const cancel = () => {
        generation += 1;
        cleanup();
    };

    const open = (
        measure: MeasureMessageAnchor,
        show: (anchor: MessageAnchor) => void,
        valid: () => boolean,
    ) => {
        cancel();
        const request = generation;
        const current = () => request === generation && valid();
        const measureAndShow = () => {
            if (!current()) return;
            cleanup();
            measure((anchor) => {
                if (!current() || (env.ios && env.keyboardVisible())) return;
                if (anchor.width <= 0 || anchor.height <= 0) return;
                generation += 1;
                show(anchor);
            });
        };

        // Android and an already-unfocused iPhone retain their immediate path.
        if (!env.ios || (!env.keyboardVisible() && !env.inputFocused())) {
            measureAndShow();
            return;
        }

        const afterHide = () => {
            if (!current() || cancelFrame) return;
            cancelFrame = env.nextFrame(() => {
                cancelFrame = undefined;
                if (current() && !env.keyboardVisible()) measureAndShow();
            });
        };
        // Subscribe before blur: native hide can complete synchronously.
        removeHideListener = env.onKeyboardHidden(afterHide);
        cancelDeadline = env.deadline(() => {
            if (!current()) { cancel(); return; }
            if (env.keyboardVisible()) { cancel(); return; }
            // Missing hide event: re-check actual visibility, never open over it.
            afterHide();
        });
        env.dismissKeyboard();
        if (!env.keyboardVisible()) afterHide();
    };

    return { open, cancel };
}
