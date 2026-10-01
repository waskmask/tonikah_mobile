import { useSyncExternalStore } from 'react';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import type { CachedInbox } from '@/lib/chatInboxCache';

function subscribe(onChange: () => void) {
    return queryClient.getQueryCache().subscribe((event) => {
        if (event?.query?.queryKey[0] === queryKeys.chat.inbox[0]
            && event.query.queryKey[1] === queryKeys.chat.inbox[1]) {
            onChange();
        }
    });
}

function getSnapshot() {
    return queryClient.getQueryData<CachedInbox>(queryKeys.chat.inbox);
}

export function useCachedInbox() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
