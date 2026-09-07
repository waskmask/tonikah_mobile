import { useSyncExternalStore } from 'react';
import { connectivity } from '@/lib/connectivity';

export function useConnectivity() {
    const status = useSyncExternalStore(
        connectivity.subscribe,
        connectivity.getSnapshot,
        connectivity.getSnapshot,
    );

    return {
        status,
        isOffline: status === 'offline',
        isOnline: status === 'online',
    };
}
