import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatService, ChatMessage } from '@/lib/chatService';
import { loadCachedMessages, saveCachedMessages } from '@/lib/chatCache';

const KEY_PREFIX = 'chat:outbox:';
const MAX_ITEMS = 10;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type QueuedTextMessage = {
    tempId: string;
    userId: string;
    conversationId: string;
    content: string;
    replyTo?: string;
    createdAt: string;
};

export type OfflineQueueEvent =
    | { type: 'sent'; item: QueuedTextMessage; message: ChatMessage }
    | { type: 'failed'; item: QueuedTextMessage; error: string };

type Listener = (event: OfflineQueueEvent) => void;

const listeners = new Set<Listener>();
const flushes = new Map<string, Promise<void>>();

const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;

async function readQueue(userId: string): Promise<QueuedTextMessage[]> {
    if (!userId) return [];
    try {
        const raw = await AsyncStorage.getItem(keyFor(userId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeQueue(userId: string, items: QueuedTextMessage[]) {
    if (items.length) await AsyncStorage.setItem(keyFor(userId), JSON.stringify(items));
    else await AsyncStorage.removeItem(keyFor(userId));
}

function isExpired(item: QueuedTextMessage) {
    const created = new Date(item.createdAt).getTime();
    return !Number.isFinite(created) || Date.now() - created > MAX_AGE_MS;
}

function emit(event: OfflineQueueEvent) {
    listeners.forEach((listener) => listener(event));
}

async function persistFailedItem(item: QueuedTextMessage) {
    const cached = await loadCachedMessages(item.userId, item.conversationId) || [];
    if (cached.some((message) => message.tempId === item.tempId || message.clientMessageId === item.tempId)) return;
    await saveCachedMessages(item.userId, item.conversationId, [
        ...cached,
        {
            id: item.tempId,
            tempId: item.tempId,
            clientMessageId: item.tempId,
            conversationId: item.conversationId,
            sender: item.userId,
            type: 'text',
            content: item.content,
            replyTo: item.replyTo || null,
            createdAt: item.createdAt,
            reactions: [],
            pending: false,
            queued: false,
            failed: true,
        },
    ]);
}

export function subscribeOfflineMessageQueue(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export async function enqueueOfflineTextMessage(item: QueuedTextMessage) {
    if (!item.userId || !item.conversationId || item.conversationId === 'new' || !item.content.trim()) {
        throw new Error('invalid_queue_item');
    }
    const current = (await readQueue(item.userId)).filter((queued) => !isExpired(queued));
    if (current.some((queued) => queued.tempId === item.tempId)) return;
    if (current.length >= MAX_ITEMS) throw new Error('offline_queue_full');
    await writeQueue(item.userId, [...current, item]);
}

export async function queuedMessagesForConversation(userId: string, conversationId: string) {
    const current = await readQueue(userId);
    const active = current.filter((item) => !isExpired(item));
    if (active.length !== current.length) await writeQueue(userId, active);
    return active.filter((item) => item.conversationId === conversationId);
}

export async function clearOfflineMessageQueue(userId?: string | null) {
    if (userId) {
        await AsyncStorage.removeItem(keyFor(userId));
        return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const matching = keys.filter((key) => key.startsWith(KEY_PREFIX));
    if (matching.length) await AsyncStorage.multiRemove(matching);
}

async function flush(userId: string) {
    let queue = await readQueue(userId);
    const expired = queue.filter(isExpired);
    queue = queue.filter((item) => !isExpired(item));
    for (const item of expired) {
        await persistFailedItem(item);
        emit({ type: 'failed', item, error: 'offline_message_expired' });
    }
    await writeQueue(userId, queue);

    while (queue.length) {
        const item = queue[0];
        const result = await chatService.send({
            conversationId: item.conversationId,
            content: item.content,
            type: 'text',
            replyTo: item.replyTo,
            clientMessageId: item.tempId,
        });

        if (result.success && result.message) {
            queue = queue.slice(1);
            await writeQueue(userId, queue);
            emit({ type: 'sent', item, message: result.message });
            continue;
        }

        const error = result.errorMessage
            || (typeof result.message === 'string' ? result.message : '')
            || 'message_failed';
        if (error === 'network_error' || result.code === 'MEMBERSHIP_REQUIRED' || error === 'membership_required') {
            break;
        }

        queue = queue.slice(1);
        await writeQueue(userId, queue);
        await persistFailedItem(item);
        emit({ type: 'failed', item, error });
    }
}

export function flushOfflineMessageQueue(userId: string) {
    if (!userId) return Promise.resolve();
    const existing = flushes.get(userId);
    if (existing) return existing;
    const task = flush(userId).finally(() => flushes.delete(userId));
    flushes.set(userId, task);
    return task;
}
