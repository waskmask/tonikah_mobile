import { Config } from '@/constants/config';

export type ConnectivityStatus = 'unknown' | 'online' | 'offline';

let status: ConnectivityStatus = 'unknown';
const listeners = new Set<() => void>();

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            await fetch(pingUrl(), { method: 'GET', signal: controller.signal });
            setStatus('online');
            return true;
        } catch {
            setStatus('offline');
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    },
};
