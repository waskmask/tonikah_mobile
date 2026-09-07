import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useChatSocket } from '@/hooks/useChatSocket';
import { CURRENT_USER_STATUS_QUERY_KEY } from '@/hooks/useCurrentUserStatus';
import {
    GalleryModerationUpdateEvent,
    isGalleryModerationActive,
    notifyGalleryModerationResult,
    patchGalleryModerationUpdate,
    useGalleryModerationEventGuard,
    useGalleryModerationReconciliation,
} from '@/hooks/useGalleryModeration';
import { useLanguage } from '@/hooks/useLanguage';
import { galleryService, GalleryResponse } from '@/lib/galleryService';
import { t } from '@/lib/profileDisplay';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/authStore';

export function GalleryEligibilityListener() {
    const queryClient = useQueryClient();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const { currentLanguage } = useLanguage();
    const shouldProcessEvent = useGalleryModerationEventGuard();
    const notifiedStatusesRef = useRef<Map<string, { status: string; updatedAt: number }>>(new Map());
    const previousStatusesRef = useRef<Map<string, string> | null>(null);
    const translate = useCallback(
        (key: string, fallback?: string) => t(key, fallback),
        [currentLanguage],
    );
    const galleryQuery = useQuery<GalleryResponse>({
        queryKey: queryKeys.gallery.me,
        queryFn: galleryService.fetchMe,
        enabled: isAuthenticated,
        staleTime: 15_000,
        refetchInterval: (query) =>
            query.state.data?.gallery?.some((item) =>
                isGalleryModerationActive(item.moderationMeta?.status),
            )
                ? 2500
                : false,
        refetchIntervalInBackground: false,
    });

    const notifyOnce = useCallback((update: GalleryModerationUpdateEvent) => {
        const imageUuid = update.imageUuid;
        const status = update.deleted ? 'rejected' : String(update.status || '');
        if (!imageUuid || !['approved', 'pending_review', 'rejected'].includes(status)) return;

        const updatedAt = Date.parse(String(update.updatedAt || ''));
        const previous = notifiedStatusesRef.current.get(imageUuid);
        if (
            previous?.status === status
            && (!Number.isFinite(updatedAt) || updatedAt <= previous.updatedAt)
        ) return;

        notifiedStatusesRef.current.set(imageUuid, {
            status,
            updatedAt: Number.isFinite(updatedAt) ? updatedAt : previous?.updatedAt || 0,
        });
        notifyGalleryModerationResult(update, translate);
    }, [translate]);

    const { connected } = useChatSocket({
        enabled: isAuthenticated,
        onGalleryModerationUpdated: (update) => {
            if (!shouldProcessEvent(update)) return;
            notifyOnce(update);
            queryClient.setQueryData<GalleryResponse>(queryKeys.gallery.me, (current) =>
                patchGalleryModerationUpdate(current, update),
            );
            void queryClient.invalidateQueries({ queryKey: queryKeys.gallery.me });
            void queryClient.invalidateQueries({
                queryKey: CURRENT_USER_STATUS_QUERY_KEY,
            });
        },
    });

    useEffect(() => {
        if (!isAuthenticated) {
            notifiedStatusesRef.current.clear();
            previousStatusesRef.current = null;
            queryClient.removeQueries({ queryKey: queryKeys.gallery.me });
            queryClient.removeQueries({
                queryKey: CURRENT_USER_STATUS_QUERY_KEY,
            });
            return;
        }
        if (connected) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.gallery.me });
            void queryClient.invalidateQueries({
                queryKey: CURRENT_USER_STATUS_QUERY_KEY,
            });
        }
    }, [connected, isAuthenticated, queryClient]);

    useGalleryModerationReconciliation(
        () => queryClient.invalidateQueries({ queryKey: queryKeys.gallery.me }),
        isAuthenticated,
    );

    useEffect(() => {
        const currentStatuses = new Map<string, string>();
        for (const item of galleryQuery.data?.gallery || []) {
            const status = item.moderationMeta?.status;
            if (item.uuid && status) currentStatuses.set(item.uuid, status);
        }

        const previousStatuses = previousStatusesRef.current;
        previousStatusesRef.current = currentStatuses;
        if (!previousStatuses) return;

        for (const [imageUuid, status] of currentStatuses) {
            const previousStatus = previousStatuses.get(imageUuid);
            if (isGalleryModerationActive(previousStatus) && !isGalleryModerationActive(status)) {
                notifyOnce({ imageUuid, status });
            }
        }
    }, [galleryQuery.data, notifyOnce]);

    return null;
}
