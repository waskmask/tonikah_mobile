import { useMessagingAccessExpiry } from '@/hooks/useCurrentUserStatus';

export function MembershipAccessListener() {
    // Expiry changes access immediately and refreshes the server snapshot. Chat
    // caches stay account-scoped and are hidden by the gates until access returns.
    useMessagingAccessExpiry();
    return null;
}
