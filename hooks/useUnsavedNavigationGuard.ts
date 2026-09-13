import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';

type Options = {
    dirty: boolean;
    leaveFallback: () => void;
};

/** Intercepts header, hardware, gesture, and dispatched navigation while a
    screen has an unsaved draft. The caller owns the confirmation UI. */
export function useUnsavedNavigationGuard({ dirty, leaveFallback }: Options) {
    const navigation = useNavigation();
    const [confirmationVisible, setConfirmationVisible] = useState(false);
    const pendingActionRef = useRef<any>(null);
    const allowRemovalRef = useRef(false);

    useEffect(() => navigation.addListener('beforeRemove', (event: any) => {
        if (!dirty || allowRemovalRef.current) return;
        event.preventDefault();
        pendingActionRef.current = event.data.action;
        setConfirmationVisible(true);
    }), [dirty, navigation]);

    const allowAndRun = useCallback((action: () => void) => {
        allowRemovalRef.current = true;
        action();
        setTimeout(() => {
            allowRemovalRef.current = false;
        }, 0);
    }, []);

    const requestClose = useCallback(() => {
        if (dirty) {
            pendingActionRef.current = null;
            setConfirmationVisible(true);
            return;
        }
        allowAndRun(leaveFallback);
    }, [allowAndRun, dirty, leaveFallback]);

    const stay = useCallback(() => {
        pendingActionRef.current = null;
        setConfirmationVisible(false);
    }, []);

    const leave = useCallback(() => {
        const pendingAction = pendingActionRef.current;
        pendingActionRef.current = null;
        setConfirmationVisible(false);
        allowAndRun(() => {
            if (pendingAction) navigation.dispatch(pendingAction);
            else leaveFallback();
        });
    }, [allowAndRun, leaveFallback, navigation]);

    return {
        confirmationVisible,
        requestClose,
        stay,
        leave,
        setConfirmationVisible,
    };
}
