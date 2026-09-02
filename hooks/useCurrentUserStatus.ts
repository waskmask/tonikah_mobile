import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

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
};

export const CURRENT_USER_STATUS_QUERY_KEY = ['users', 'me'] as const;

const CURRENT_USER_STATUS_STALE_TIME_MS = 5 * 60_000;
const CURRENT_USER_STATUS_GC_TIME_MS = 30 * 60_000;
const MODERATION_PROCESSING_POLL_MS = 3_000;

async function fetchCurrentUserStatus(): Promise<CurrentUserStatus> {
    const response = await api.get('/users/me');
    if (!response.success) {
        throw new Error(response.message || 'current_user_status_failed');
    }
    return response as CurrentUserStatus;
}

export function useCurrentUserStatus() {
    return useQuery<CurrentUserStatus, Error>({
        queryKey: CURRENT_USER_STATUS_QUERY_KEY,
        queryFn: fetchCurrentUserStatus,
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
    };
}
