import * as FileSystem from 'expo-file-system/legacy';
import { MessageMedia } from '@/lib/chatService';

const ROOT_DIR = `${FileSystem.documentDirectory || ''}chat-media/`;

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

    const downloaded = await FileSystem.downloadAsync(remoteUri, fileUri);
    if (downloaded.status < 200 || downloaded.status >= 300) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
        throw new Error('download_failed');
    }
    return { uri: downloaded.uri, cached: true };
}

export async function deleteCachedChatMediaForMessage(input: Pick<CacheInput, 'userId' | 'conversationId' | 'messageId'>) {
    if (!FileSystem.documentDirectory || !input.messageId) return;
    const dir = await FileSystem.getInfoAsync(ROOT_DIR);
    if (!dir.exists) return;

    const message = safePart(input.messageId);
    const files = await FileSystem.readDirectoryAsync(ROOT_DIR);
    await Promise.all(
        files
            .filter((file) => file.includes(`_${message}_`))
            .map((file) => FileSystem.deleteAsync(`${ROOT_DIR}${file}`, { idempotent: true }).catch(() => undefined)),
    );
}

export async function clearChatMediaCache() {
    if (!FileSystem.documentDirectory) return;
    await FileSystem.deleteAsync(ROOT_DIR, { idempotent: true }).catch(() => undefined);
}

export async function clearChatMediaCacheForUser(userId: string) {
    if (!FileSystem.documentDirectory || !userId) return;
    const dir = await FileSystem.getInfoAsync(ROOT_DIR);
    if (!dir.exists) return;

    const prefix = `${safePart(userId)}_`;
    const files = await FileSystem.readDirectoryAsync(ROOT_DIR);
    await Promise.all(
        files
            .filter((file) => file.startsWith(prefix))
            .map((file) => FileSystem.deleteAsync(`${ROOT_DIR}${file}`, { idempotent: true }).catch(() => undefined)),
    );
}
