import { useCallback } from 'react';

import { useMessagingAccessExpiry } from '@/hooks/useCurrentUserStatus';
import { clearAllCachedMessages } from '@/lib/chatCache';
import { clearChatMediaCache } from '@/lib/chatMediaCache';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';

export function MembershipAccessListener() {
    const userId = useAuthStore((state) => String(state.user?._id || state.user?.id || ''));
    const clearProtected = useCallback(() => {
        queryClient.removeQueries({ queryKey: ['chat'] });
        void Promise.all([
            clearAllCachedMessages(userId),
            clearChatMediaCache(),
        ]);
    }, [userId]);

    useMessagingAccessExpiry(clearProtected);
    return null;
}
