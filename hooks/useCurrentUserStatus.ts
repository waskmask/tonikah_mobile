import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { MessagingAccess, TrialOffer } from '@/lib/messagingAccess';
import { accessExpiresIn, canOpenMessaging, withMessagingAccessClock } from '@/lib/messagingAccess';
import { useAuthStore } from '@/store/authStore';

export type PhotoQualificationStatus =
    | 'approved'
    | 'missing'
    | 'processing'
    | 'pending_review'
    | 'rejected';

export type CurrentUserStatus = {
    _id?: string;
    id?: string;
    email?: string | null;
    email_verified?: boolean;
    emailVerified?: boolean;
    hasQualifiedPhoto?: boolean;
    photoQualificationStatus?: PhotoQualificationStatus;
    messagingAccess?: MessagingAccess;
    trialOffer?: TrialOffer;
};

export const CURRENT_USER_STATUS_QUERY_KEY = ['users', 'me'] as const;

const CURRENT_USER_STATUS_STALE_TIME_MS = 5 * 60_000;
const CURRENT_USER_STATUS_GC_TIME_MS = 30 * 60_000;
const MODERATION_PROCESSING_POLL_MS = 3_000;

export async function fetchCurrentUserStatus(): Promise<CurrentUserStatus> {
    const response = await api.get('/users/me');
    if (!response.success) {
        throw new Error(response.message || 'current_user_status_failed');
    }
    const status = response as CurrentUserStatus;
    return status.messagingAccess
        ? { ...status, messagingAccess: withMessagingAccessClock(status.messagingAccess) }
        : status;
}

export function useCurrentUserStatus() {
    const cachedUser = useAuthStore((state) => state.user);
    return useQuery<CurrentUserStatus, Error>({
        queryKey: CURRENT_USER_STATUS_QUERY_KEY,
        queryFn: fetchCurrentUserStatus,
        initialData: cachedUser?.messagingAccess
            ? {
                _id: cachedUser._id,
                id: cachedUser.id,
                email: cachedUser.email,
                email_verified: cachedUser.email_verified,
                messagingAccess: cachedUser.messagingAccess,
                trialOffer: cachedUser.trialOffer,
            }
            : undefined,
        staleTime: CURRENT_USER_STATUS_STALE_TIME_MS,
        gcTime: CURRENT_USER_STATUS_GC_TIME_MS,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: (query) =>
            query.state.data?.photoQualificationStatus === 'processing'
                ? MODERATION_PROCESSING_POLL_MS
                : false,
        refetchIntervalInBackground: false,
    });
}

export function useMessagingEligibilityStatus() {
    const query = useCurrentUserStatus();
    return {
        ...query,
        email: query.data?.email ?? null,
        emailVerified: Boolean(
            query.data?.email_verified ?? query.data?.emailVerified,
        ),
        hasQualifiedPhoto: query.data?.hasQualifiedPhoto === true,
        photoQualificationStatus:
            query.data?.photoQualificationStatus || ('missing' as const),
        messagingAccess: query.data?.messagingAccess ?? null,
        trialOffer: query.data?.trialOffer ?? null,
        canOpenMessaging: canOpenMessaging(query.data?.messagingAccess),
    };
}

export function useMessagingAccessExpiry(onExpire?: () => void) {
    const query = useCurrentUserStatus();
    const access = query.data?.messagingAccess;
    const handledKeyRef = React.useRef<string | null>(null);
    const delay = access?.required && access.membershipActive
        ? accessExpiresIn(access)
        : null;
    React.useEffect(() => {
        if (!access?.required) {
            handledKeyRef.current = null;
            return;
        }
        const decisionKey = [
            access.validUntil || '',
            access.allowed ? '1' : '0',
            access.membershipActive ? '1' : '0',
            access.status,
        ].join(':');
        if (!canOpenMessaging(access)) {
            if (handledKeyRef.current === decisionKey) return;
            handledKeyRef.current = decisionKey;
            onExpire?.();
            void query.refetch();
            return;
        }
        if (delay == null) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const schedule = () => {
            const remaining = accessExpiresIn(access);
            if (remaining == null) return;
            timer = setTimeout(() => {
                if (canOpenMessaging(access)) {
                    schedule();
                    return;
                }
                handledKeyRef.current = decisionKey;
                onExpire?.();
                void query.refetch();
            }, Math.min(remaining + 250, 2_147_000_000));
        };
        schedule();
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [access, delay, onExpire, query.refetch]);
}
