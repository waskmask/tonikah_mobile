type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;

type IdleRuntime = typeof globalThis & {
    requestIdleCallback?: (callback: IdleCallback, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
};

export function scheduleIdleWork(callback: () => void, timeout = 1000) {
    const runtime = globalThis as IdleRuntime;
    if (typeof runtime.requestIdleCallback === 'function') {
        const handle = runtime.requestIdleCallback(() => callback(), { timeout });
        return () => runtime.cancelIdleCallback?.(handle);
    }

    const handle = setTimeout(callback, 0);
    return () => clearTimeout(handle);
}
