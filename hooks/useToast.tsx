import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Toast, ToastIcon, ToastType } from '@/components/ui/Toast';

interface ToastState {
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
    icon?: ToastIcon;
}

type ToastHandle = {
    show: (message: string, type?: ToastType, duration?: number, options?: { icon?: ToastIcon }) => void;
    hide: () => void;
};

let globalToastRef: ToastHandle | null = null;
const toastStack: ToastHandle[] = [];

export function ToastProvider() {
    const [state, setState] = useState<ToastState>({
        visible: false,
        message: '',
        type: 'info',
        duration: 4000,
        icon: undefined,
    });

    const show = useCallback((message: string, type: ToastType = 'info', duration: number = 4000, options?: { icon?: ToastIcon }) => {
        setState({ visible: true, message, type, duration, icon: options?.icon });
    }, []);

    const hide = useCallback(() => {
        setState((prev) => ({ ...prev, visible: false }));
    }, []);

    const handle = useMemo(() => ({ show, hide }), [show, hide]);

    useEffect(() => {
        toastStack.push(handle);
        globalToastRef = handle;

        return () => {
            const index = toastStack.indexOf(handle);
            if (index >= 0) toastStack.splice(index, 1);
            globalToastRef = toastStack[toastStack.length - 1] || null;
        };
    }, [handle]);

    return (
        <Toast
            visible={state.visible}
            message={state.message}
            type={state.type}
            duration={state.duration}
            icon={state.icon}
            onDismiss={hide}
        />
    );
}

/** Imperative access from event handlers without hook wiring — proxies the
    same global ref the hook uses. */
export const toast: ToastHandle = {
    show: (message, type = 'info', duration = 4000, options) => {
        if (globalToastRef) {
            globalToastRef.show(message, type, duration, options);
        } else {
            console.warn('ToastProvider is not mounted. Cannot show toast:', message);
        }
    },
    hide: () => {
        if (globalToastRef) globalToastRef.hide();
    },
};

export function useToast() {
    const show = useCallback((message: string, type: ToastType = 'info', duration: number = 4000, options?: { icon?: ToastIcon }) => {
        if (globalToastRef) {
            globalToastRef.show(message, type, duration, options);
        } else {
            console.warn('ToastProvider is not mounted. Cannot show toast:', message);
        }
    }, []);

    const hide = useCallback(() => {
        if (globalToastRef) globalToastRef.hide();
    }, []);

    return useMemo(() => ({ show, hide }), [show, hide]);
}

export type { ToastIcon, ToastType };
