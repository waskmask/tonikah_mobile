import { DEFAULT_EXPLORE_FILTERS, buildExploreParams } from '@/lib/exploreFilters';
import { hasRecentExploreLocationVerification } from '@/lib/exploreLocationVerification';
import { readExploreDeckCache, type CachedExploreDeck } from '@/lib/exploreDeckCache';
import { markStartup } from '@/lib/performanceDiagnostics';
import { usersService, type UserListResponse } from '@/lib/usersService';

const EXPLORE_BATCH_LIMIT = 30;

export type ExploreStartupResult = {
    cached: CachedExploreDeck | null;
    response: UserListResponse | null;
    filterKey: string | null;
};

const startupRequests = new Map<string, Promise<ExploreStartupResult>>();

export function primeExploreStartup(userId: string, hasProfileLocation: boolean) {
    if (!userId || !hasProfileLocation) return null;
    const existing = startupRequests.get(userId);
    if (existing) return existing;

    const request = (async (): Promise<ExploreStartupResult> => {
        const [cached, recentlyVerified] = await Promise.all([
            readExploreDeckCache(userId),
            hasRecentExploreLocationVerification(userId),
        ]);
        if (!recentlyVerified) return { cached, response: null, filterKey: null };

        const filters = cached?.filters || DEFAULT_EXPLORE_FILTERS;
        const params = buildExploreParams(filters);
        markStartup('explore-preload-request-start');
        const response = await usersService.list({
            limit: EXPLORE_BATCH_LIMIT,
            ...params,
        });
        markStartup('explore-preload-response-received', { success: Boolean(response.success) });
        return { cached, response, filterKey: JSON.stringify(params) };
    })().catch(() => ({ cached: null, response: null, filterKey: null }));

    startupRequests.set(userId, request);
    return request;
}

export function takeExploreStartup(userId: string) {
    const request = startupRequests.get(userId) || null;
    startupRequests.delete(userId);
    return request;
}

export function clearExploreStartup(userId?: string | null) {
    if (userId) startupRequests.delete(userId);
    else startupRequests.clear();
}
