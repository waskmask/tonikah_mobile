import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Toast, ToastType } from '@/components/ui/Toast';

interface ToastState {
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
}

type ToastHandle = {
    show: (message: string, type?: ToastType, duration?: number) => void;
    hide: () => void;
};

let globalToastRef: ToastHandle | null = null;
const toastStack: ToastHandle[] = [];

// The provider that should be mounted near the Root Layout
export function ToastProvider() {
    const [state, setState] = useState<ToastState>({
        visible: false,
        message: '',
        type: 'info',
        duration: 4000,
    });

    const show = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        setState({ visible: true, message, type, duration });
    }, []);

    const hide = useCallback(() => {
        setState(prev => ({ ...prev, visible: false }));
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
      visible= { state.visible }
    message = { state.message }
    type = { state.type }
    duration = { state.duration }
    onDismiss = { hide }
        />
  );
}

// Hook for triggering toasts from components
export function useToast() {
    const show = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
        if (globalToastRef) {
            globalToastRef.show(message, type, duration);
        } else {
            console.warn("ToastProvider is not mounted. Cannot show toast:", message);
        }
    }, []);

    const hide = useCallback(() => {
        if (globalToastRef) globalToastRef.hide();
    }, []);

    return { show, hide };
}
