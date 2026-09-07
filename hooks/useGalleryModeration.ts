import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { toast } from '@/hooks/useToast';
import type { GalleryResponse } from '@/lib/galleryService';

export type GalleryModerationUpdateEvent = {
    imageUuid?: string;
    status?: string;
    safe?: boolean;
    reasonCodes?: string[];
    attempt?: number;
    maxAttempts?: number;
    updatedAt?: string;
    deleted?: boolean;
};

type Translator = (key: string, fallback?: string) => string;
type ModerationGalleryItem = {
    uuid?: string;
    moderationMeta?: {
        status?: string;
    };
};

const ACTIVE_STATUSES = new Set(['queued', 'processing']);

export function isGalleryModerationActive(status?: string): boolean {
    return ACTIVE_STATUSES.has(String(status || ''));
}

export function patchGalleryModerationUpdate(
    current: GalleryResponse | undefined,
    update: GalleryModerationUpdateEvent,
): GalleryResponse | undefined {
    if (!current?.gallery || !update.imageUuid) return current;

    const status = String(update.status || '');
    if (update.deleted || status === 'rejected') {
        return {
            ...current,
            gallery: current.gallery.filter((item) => item.uuid !== update.imageUuid),
        };
    }

    let matched = false;
    const gallery = current.gallery.map((item) => {
        if (item.uuid !== update.imageUuid) return item;
        matched = true;
        return {
            ...item,
            ...(typeof update.safe === 'boolean' ? { safe: update.safe } : {}),
            moderationMeta: {
                ...item.moderationMeta,
                ...(status ? { status } : {}),
                ...(update.reasonCodes ? { reasonCodes: update.reasonCodes } : {}),
                ...(update.updatedAt ? { updatedAt: update.updatedAt } : {}),
            },
        };
    });

    return matched ? { ...current, gallery } : current;
}

export function notifyGalleryModerationResult(
    update: GalleryModerationUpdateEvent,
    translate: Translator,
) {
    const status = String(update.status || '');
    if (status === 'approved') {
        toast.show(
            translate('image_moderation_approved_toast', 'Photo approved and now visible on your profile.'),
            'success',
            4000,
        );
    } else if (status === 'rejected' || update.deleted) {
        toast.show(
            translate(
                'image_moderation_rejected_toast',
                'Photo rejected and removed from your gallery.',
            ),
            'error',
            5000,
        );
    } else if (status === 'pending_review') {
        toast.show(
            translate(
                'image_moderation_review_toast',
                'Photo needs human review and remains hidden from other members.',
            ),
            'warning',
            5000,
        );
    }
}

/**
 * Socket events can arrive after a reconnect or after a polling refresh.
 * The backend's updatedAt timestamp is the ordering authority, so an older
 * event can never restore a stale moderation state.
 */
export function useGalleryModerationEventGuard() {
    const latestTimestampRef = useRef<Map<string, number>>(new Map());

    return useCallback((update: GalleryModerationUpdateEvent) => {
        const imageUuid = update.imageUuid;
        const timestamp = Date.parse(String(update.updatedAt || ''));
        if (!imageUuid || !Number.isFinite(timestamp)) return true;

        const previousTimestamp = latestTimestampRef.current.get(imageUuid);
        if (previousTimestamp !== undefined && timestamp <= previousTimestamp) {
            return false;
        }

        latestTimestampRef.current.set(imageUuid, timestamp);
        return true;
    }, []);
}

/** Refresh when the app returns from the background so a completed worker job
 * is reflected even when its realtime event arrived while the app was asleep. */
export function useGalleryModerationReconciliation(
    refresh: () => void | Promise<unknown>,
    enabled = true,
) {
    const previousStateRef = useRef<AppStateStatus>(AppState.currentState);

    useEffect(() => {
        if (!enabled) return;

        const subscription = AppState.addEventListener('change', (nextState) => {
            const previousState = previousStateRef.current;
            previousStateRef.current = nextState;
            if (nextState === 'active' && previousState !== 'active') {
                void Promise.resolve(refresh()).catch(() => undefined);
            }
        });

        return () => subscription.remove();
    }, [enabled, refresh]);
}

/** Fallback notification path for polling/foreground reconciliation. */
export function useGalleryModerationNotifications(
    items: ModerationGalleryItem[],
    translate: Translator,
) {
    const previousStatusesRef = useRef<Map<string, string> | null>(null);

    useEffect(() => {
        const currentStatuses = new Map<string, string>();
        for (const item of items) {
            const status = item.moderationMeta?.status;
            if (item.uuid && status) currentStatuses.set(item.uuid, status);
        }

        const previousStatuses = previousStatusesRef.current;
        previousStatusesRef.current = currentStatuses;
        if (!previousStatuses) return;

        for (const [imageUuid, status] of currentStatuses) {
            const previousStatus = previousStatuses.get(imageUuid);
            if (!isGalleryModerationActive(previousStatus) || isGalleryModerationActive(status)) {
                continue;
            }
            notifyGalleryModerationResult({ imageUuid, status }, translate);
        }
    }, [items, translate]);
}
