import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExploreFilterState } from '@/lib/exploreFilters';

const CACHE_PREFIX = 'explore:deck:v1:';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHED_PROFILES = 40;

export type CachedExploreDeck = {
    profiles: any[];
    filters: ExploreFilterState;
    nextCursor: string | null;
    hasMore: boolean;
    mode: 'fresh' | 'skipped';
    savedAt: number;
};

function cacheKey(userId: string) {
    return `${CACHE_PREFIX}${userId}`;
}

function hasValidFilters(value: unknown): value is ExploreFilterState {
    if (!value || typeof value !== 'object') return false;
    const filters = value as Partial<ExploreFilterState>;
    return Number.isFinite(filters.ageMin)
        && Number.isFinite(filters.ageMax)
        && Number.isFinite(filters.heightMin)
        && Number.isFinite(filters.heightMax)
        && Array.isArray(filters.country)
        && Array.isArray(filters.marital_status)
        && Array.isArray(filters.sect)
        && Array.isArray(filters.education)
        && Array.isArray(filters.ethnic_group)
        && Array.isArray(filters.born_muslim)
        && Array.isArray(filters.following);
}

export async function readExploreDeckCache(userId: string): Promise<CachedExploreDeck | null> {
    if (!userId) return null;
    const raw = await AsyncStorage.getItem(cacheKey(userId)).catch(() => null);
    if (!raw) return null;

    try {
        const cached = JSON.parse(raw) as CachedExploreDeck;
        if (
            !Array.isArray(cached.profiles)
            || !hasValidFilters(cached.filters)
            || !Number.isFinite(cached.savedAt)
            || Date.now() - cached.savedAt > CACHE_TTL_MS
        ) {
            await AsyncStorage.removeItem(cacheKey(userId)).catch(() => undefined);
            return null;
        }
        return cached;
    } catch {
        await AsyncStorage.removeItem(cacheKey(userId)).catch(() => undefined);
        return null;
    }
}

export async function writeExploreDeckCache(
    userId: string,
    value: Omit<CachedExploreDeck, 'savedAt'>,
): Promise<void> {
    if (!userId) return;
    const cached: CachedExploreDeck = {
        ...value,
        profiles: value.profiles.slice(0, MAX_CACHED_PROFILES),
        savedAt: Date.now(),
    };
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(cached));
}

export async function clearExploreDeckCache(userId?: string | null): Promise<void> {
    if (userId) {
        await AsyncStorage.removeItem(cacheKey(userId)).catch(() => undefined);
        return;
    }

    const keys = await AsyncStorage.getAllKeys().catch(() => []);
    const matching = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    if (matching.length) await AsyncStorage.multiRemove(matching).catch(() => undefined);
}
