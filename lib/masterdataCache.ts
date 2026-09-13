import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileService } from '@/lib/profileService';

export type MasterdataItem = Record<string, any>;

export type CachedMasterdata = {
    items: MasterdataItem[];
    savedAt: number;
    version?: string;
};

const CACHE_PREFIX = '@tonikah/masterdata/v1';
const FRESH_FOR_MS = 24 * 60 * 60 * 1000;
const RETAIN_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const memory = new Map<string, CachedMasterdata>();
const refreshes = new Map<string, Promise<CachedMasterdata>>();
let versionRequest: Promise<string | null> | null = null;

const cacheKey = (type: string, language: string) =>
    `${CACHE_PREFIX}:${language.trim().toLowerCase() || 'en'}:${type.trim().toLowerCase()}`;

const normalizeVersion = (value: unknown) => {
    const version = String(value ?? '').trim();
    return version || undefined;
};

const isCacheShape = (value: any): value is CachedMasterdata =>
    Boolean(value && Array.isArray(value.items) && Number.isFinite(value.savedAt));

export function getMemoryMasterdata(type: string, language: string) {
    const key = cacheKey(type, language);
    const entry = memory.get(key);
    if (entry && Date.now() - entry.savedAt >= RETAIN_FOR_MS) {
        memory.delete(key);
        return undefined;
    }
    return entry;
}

export function isMasterdataFresh(entry: CachedMasterdata, now = Date.now()) {
    return now - entry.savedAt < FRESH_FOR_MS;
}

export async function readMasterdataCache(type: string, language: string) {
    const key = cacheKey(type, language);
    const inMemory = memory.get(key);
    if (inMemory && Date.now() - inMemory.savedAt < RETAIN_FOR_MS) return inMemory;

    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!isCacheShape(parsed) || Date.now() - parsed.savedAt >= RETAIN_FOR_MS) {
            memory.delete(key);
            void AsyncStorage.removeItem(key).catch(() => undefined);
            return null;
        }
        const entry: CachedMasterdata = {
            items: parsed.items,
            savedAt: parsed.savedAt,
            ...(normalizeVersion(parsed.version) ? { version: normalizeVersion(parsed.version) } : {}),
        };
        memory.set(key, entry);
        return entry;
    } catch {
        return null;
    }
}

async function writeMasterdataCache(
    type: string,
    language: string,
    items: MasterdataItem[],
    version?: string,
) {
    const key = cacheKey(type, language);
    const entry: CachedMasterdata = {
        items,
        savedAt: Date.now(),
        ...(normalizeVersion(version) ? { version: normalizeVersion(version) } : {}),
    };
    memory.set(key, entry);
    await AsyncStorage.setItem(key, JSON.stringify(entry)).catch(() => undefined);
    return entry;
}

export async function fetchMasterdataVersion() {
    if (versionRequest) return versionRequest;

    versionRequest = profileService.fetchMasterdataVersion()
        .then((response) => {
            return response.success === false ? null : normalizeVersion(response.version) || null;
        })
        .catch(() => null)
        .finally(() => {
            versionRequest = null;
        });

    return versionRequest;
}

export async function refreshMasterdata(
    type: string,
    language: string,
    expectedVersion?: string | null,
) {
    const key = cacheKey(type, language);
    const existing = refreshes.get(key);
    if (existing) return existing;

    const request = profileService.fetchMasterdata(type)
        .then((response) => {
            if (response.success === false || !Array.isArray(response.data)) {
                throw new Error(response.message || `masterdata_${type}_failed`);
            }
            const version = normalizeVersion(response.version) || normalizeVersion(expectedVersion);
            return writeMasterdataCache(type, language, response.data, version);
        })
        .finally(() => {
            refreshes.delete(key);
        });

    refreshes.set(key, request);
    return request;
}
