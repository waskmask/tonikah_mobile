import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';

type Options = {
    dirty: boolean;
    leaveFallback: () => void;
    redirectRemovalToFallback?: boolean;
};

/** Intercepts header, hardware, gesture, and dispatched navigation while a
    screen has an unsaved draft. The caller owns the confirmation UI. */
export function useUnsavedNavigationGuard({
    dirty,
    leaveFallback,
    redirectRemovalToFallback = false,
}: Options) {
    const navigation = useNavigation();
    const [confirmationVisible, setConfirmationVisible] = useState(false);
    const pendingActionRef = useRef<any>(null);
    const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

    const allowAndRun = useCallback((action: () => void) => {
        setPendingLeave(() => action);
    }, []);

    usePreventRemove((dirty || redirectRemovalToFallback) && pendingLeave === null, ({ data }) => {
        if (dirty) {
            pendingActionRef.current = data.action;
            setConfirmationVisible(true);
            return;
        }
        if (redirectRemovalToFallback) {
            allowAndRun(leaveFallback);
        }
    });

    useEffect(() => {
        if (!pendingLeave) return;
        // Let native-stack receive the released guard before dispatching navigation.
        const frame = requestAnimationFrame(() => {
            pendingLeave();
        });
        return () => cancelAnimationFrame(frame);
    }, [pendingLeave]);

    // Router actions may be queued; don't re-arm while the approved exit is pending.
    useEffect(() => navigation.addListener('focus', () => {
        setPendingLeave(null);
    }), [navigation]);

    const requestClose = useCallback(() => {
        if (dirty) {
            pendingActionRef.current = null;
            setConfirmationVisible(true);
            return;
        }
        allowAndRun(leaveFallback);
    }, [allowAndRun, dirty, leaveFallback]);

    const stay = useCallback(() => {
        setPendingLeave(null);
        pendingActionRef.current = null;
        setConfirmationVisible(false);
    }, []);

    const leave = useCallback(() => {
        const pendingAction = pendingActionRef.current;
        pendingActionRef.current = null;
        setConfirmationVisible(false);
        allowAndRun(() => {
            if (redirectRemovalToFallback) leaveFallback();
            else if (pendingAction) navigation.dispatch(pendingAction);
            else leaveFallback();
        });
    }, [allowAndRun, leaveFallback, navigation, redirectRemovalToFallback]);

    return {
        confirmationVisible,
        requestClose,
        stay,
        leave,
        setConfirmationVisible,
    };
}
