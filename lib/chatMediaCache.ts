import * as FileSystem from 'expo-file-system/legacy';
import { MessageMedia } from '@/lib/chatService';

const ROOT_DIR = `${FileSystem.documentDirectory || ''}chat-media/`;
const MAX_CACHE_BYTES = 200 * 1024 * 1024;
const inFlightDownloads = new Map<string, Promise<{ uri: string; cached: boolean }>>();
const cacheGenerations = new Map<string, number>();
const pinnedUris = new Set<string>();

type CacheInput = {
    userId?: string | null;
    conversationId?: string | null;
    messageId?: string | null;
    media?: MessageMedia | null;
    url?: string | null;
    kind?: 'image' | 'voice' | 'file';
};

function safePart(value?: string | null) {
    return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96);
}

function extensionFrom(input: CacheInput) {
    const mime = input.media?.mime || '';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('png')) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('mpeg')) return 'mp3';
    if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('webm')) return 'webm';

    const url = input.url || input.media?.url || '';
    const match = url.split('?')[0]?.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (match?.[1]) return match[1].toLowerCase();

    return input.kind === 'voice' ? 'm4a' : 'webp';
}

function cacheFileUri(input: CacheInput) {
    const user = safePart(input.userId);
    const conversation = safePart(input.conversationId);
    const message = safePart(input.messageId || input.media?.key || input.url);
    const kind = safePart(input.kind || 'file');
    return `${ROOT_DIR}${user}_${conversation}_${message}_${kind}.${extensionFrom(input)}`;
}

async function ensureDir() {
    if (!FileSystem.documentDirectory) {
        throw new Error('file_system_unavailable');
    }
    const info = await FileSystem.getInfoAsync(ROOT_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(ROOT_DIR, { intermediates: true });
    }
}

async function pruneChatMediaCache(protectedUri?: string) {
    const files = await FileSystem.readDirectoryAsync(ROOT_DIR);
    const entries = await Promise.all(files.map(async (file) => {
        const uri = `${ROOT_DIR}${file}`;
        const info = await FileSystem.getInfoAsync(uri);
        return {
            uri,
            size: info.exists && typeof info.size === 'number' ? info.size : 0,
            modified: info.exists && typeof info.modificationTime === 'number' ? info.modificationTime : 0,
        };
    }));
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    if (total <= MAX_CACHE_BYTES) return;

    for (const entry of entries.sort((a, b) => a.modified - b.modified)) {
        if (total <= MAX_CACHE_BYTES) break;
        if (entry.uri === protectedUri || pinnedUris.has(entry.uri) || inFlightDownloads.has(entry.uri)) continue;
        if (entry.uri.endsWith('.download') || entry.uri.endsWith('.pending')) continue;
        await FileSystem.deleteAsync(entry.uri, { idempotent: true }).catch(() => undefined);
        total -= entry.size;
    }
}

function generationFor(uri: string) {
    return cacheGenerations.get(uri) || 0;
}

function invalidateUri(uri: string) {
    cacheGenerations.set(uri, generationFor(uri) + 1);
}

export function pinCachedChatMedia(uri?: string | null) {
    if (uri?.startsWith(ROOT_DIR)) pinnedUris.add(uri);
}

export function unpinCachedChatMedia(uri?: string | null) {
    if (uri) pinnedUris.delete(uri);
}

export async function getCachedChatMedia(input: CacheInput) {
    if (input.media?.viewOnce) return { uri: input.url || input.media?.url || '', cached: false };
    const remoteUri = input.url || input.media?.url || '';
    if (!remoteUri) return { uri: '', cached: false };

    await ensureDir();
    const fileUri = cacheFileUri(input);
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) return { uri: fileUri, cached: true };
    return { uri: remoteUri, cached: false };
}

export async function cacheChatMedia(input: CacheInput) {
    if (input.media?.viewOnce) return { uri: input.url || input.media?.url || '', cached: false };
    const remoteUri = input.url || input.media?.url || '';
    if (!remoteUri) throw new Error('missing_media_url');

    await ensureDir();
    const fileUri = cacheFileUri(input);
    const existing = await FileSystem.getInfoAsync(fileUri);
    if (existing.exists) return { uri: fileUri, cached: true };

    const currentDownload = inFlightDownloads.get(fileUri);
    if (currentDownload) return currentDownload;

    const download = (async () => {
        const generation = generationFor(fileUri);
        const temporaryUri = `${fileUri}.download`;
        await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
        try {
            const downloaded = await FileSystem.downloadAsync(remoteUri, temporaryUri);
            if (downloaded.status < 200 || downloaded.status >= 300) throw new Error('download_failed');
            if (generationFor(fileUri) !== generation) throw new Error('cache_invalidated');
            await FileSystem.moveAsync({ from: temporaryUri, to: fileUri });
            void pruneChatMediaCache(fileUri).catch(() => undefined);
            return { uri: fileUri, cached: true };
        } catch (error) {
            await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
            throw error;
        }
    })();
    inFlightDownloads.set(fileUri, download);
    try {
        return await download;
    } finally {
        inFlightDownloads.delete(fileUri);
    }
}

export async function storeLocalChatMedia(input: CacheInput & { sourceUri: string }) {
    if (input.media?.viewOnce) return { uri: input.sourceUri, cached: false };
    if (!input.sourceUri) throw new Error('missing_media_source');

    await ensureDir();
    const fileUri = cacheFileUri(input);
    const existing = await FileSystem.getInfoAsync(fileUri);
    if (existing.exists) return { uri: fileUri, cached: true };

    const temporaryUri = `${fileUri}.pending`;
    const generation = generationFor(fileUri);
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    try {
        await FileSystem.copyAsync({ from: input.sourceUri, to: temporaryUri });
        const copied = await FileSystem.getInfoAsync(temporaryUri);
        if (!copied.exists || !copied.size) throw new Error('empty_media_source');
        if (generationFor(fileUri) !== generation) throw new Error('cache_invalidated');
        await FileSystem.moveAsync({ from: temporaryUri, to: fileUri });
    } catch (error) {
        await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
        throw error;
    }
    void pruneChatMediaCache(fileUri).catch(() => undefined);
    return { uri: fileUri, cached: true };
}

export async function deleteCachedChatMediaForMessage(input: Pick<CacheInput, 'userId' | 'conversationId' | 'messageId'>) {
    if (!FileSystem.documentDirectory || !input.userId || !input.conversationId || !input.messageId) return;
    const dir = await FileSystem.getInfoAsync(ROOT_DIR);
    if (!dir.exists) return;

    const prefix = `${safePart(input.userId)}_${safePart(input.conversationId)}_${safePart(input.messageId)}_`;
    for (const uri of inFlightDownloads.keys()) {
        if (uri.startsWith(`${ROOT_DIR}${prefix}`)) invalidateUri(uri);
    }
    const files = await FileSystem.readDirectoryAsync(ROOT_DIR);
    files
        .filter((file) => file.startsWith(prefix))
        .forEach((file) => {
            const uri = `${ROOT_DIR}${file.replace(/\.(download|pending)$/, '')}`;
            invalidateUri(uri);
            pinnedUris.delete(uri);
        });
    await Promise.all(
        files
            .filter((file) => file.startsWith(prefix))
            .map((file) => FileSystem.deleteAsync(`${ROOT_DIR}${file}`, { idempotent: true }).catch(() => undefined)),
    );
}

export async function clearChatMediaCache() {
    if (!FileSystem.documentDirectory) return;
    for (const uri of inFlightDownloads.keys()) invalidateUri(uri);
    pinnedUris.clear();
    await FileSystem.deleteAsync(ROOT_DIR, { idempotent: true }).catch(() => undefined);
}

export async function clearChatMediaCacheForUser(userId: string) {
    if (!FileSystem.documentDirectory || !userId) return;
    const prefix = `${safePart(userId)}_`;
    for (const uri of inFlightDownloads.keys()) {
        if (uri.startsWith(`${ROOT_DIR}${prefix}`)) invalidateUri(uri);
    }
    const dir = await FileSystem.getInfoAsync(ROOT_DIR);
    if (!dir.exists) return;

    const files = await FileSystem.readDirectoryAsync(ROOT_DIR);
    files
        .filter((file) => file.startsWith(prefix))
        .forEach((file) => {
            const uri = `${ROOT_DIR}${file.replace(/\.(download|pending)$/, '')}`;
            invalidateUri(uri);
            pinnedUris.delete(uri);
        });
    await Promise.all(
        files
            .filter((file) => file.startsWith(prefix))
            .map((file) => FileSystem.deleteAsync(`${ROOT_DIR}${file}`, { idempotent: true }).catch(() => undefined)),
    );
}
