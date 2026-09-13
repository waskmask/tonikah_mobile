import { Config } from '@/constants/config';

export type ConnectivityStatus = 'unknown' | 'online' | 'offline';

let status: ConnectivityStatus = 'unknown';
const listeners = new Set<() => void>();
let activeCheck: Promise<boolean> | null = null;

function setStatus(next: ConnectivityStatus) {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
}

function pingUrl() {
    return `${Config.API_URL.replace(/\/api\/?$/, '')}/ping`;
}

export const connectivity = {
    getSnapshot: () => status,
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    markOnline: () => setStatus('online'),
    markOffline: () => setStatus('offline'),
    async check(timeout = 5000) {
        if (activeCheck) return activeCheck;

        activeCheck = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            await fetch(pingUrl(), {
                method: 'GET',
                signal: controller.signal,
                cache: 'no-store',
            });
            setStatus('online');
            return true;
        } catch {
            setStatus('offline');
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
        })();

        try {
            return await activeCheck;
        } finally {
            activeCheck = null;
        }
    },
    confirmRequestFailure: () => connectivity.check(3000),
};
