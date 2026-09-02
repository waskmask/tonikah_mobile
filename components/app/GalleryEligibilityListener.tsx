import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useChatSocket } from '@/hooks/useChatSocket';
import { CURRENT_USER_STATUS_QUERY_KEY } from '@/hooks/useCurrentUserStatus';
import { useAuthStore } from '@/store/authStore';

export function GalleryEligibilityListener() {
    const queryClient = useQueryClient();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const { connected } = useChatSocket({
        enabled: isAuthenticated,
        onGalleryModerationUpdated: () => {
            void queryClient.invalidateQueries({
                queryKey: CURRENT_USER_STATUS_QUERY_KEY,
            });
        },
    });

    useEffect(() => {
        if (!isAuthenticated) {
            queryClient.removeQueries({
                queryKey: CURRENT_USER_STATUS_QUERY_KEY,
            });
            return;
        }
        if (connected) {
            void queryClient.invalidateQueries({
                queryKey: CURRENT_USER_STATUS_QUERY_KEY,
            });
        }
    }, [connected, isAuthenticated, queryClient]);

    return null;
}
