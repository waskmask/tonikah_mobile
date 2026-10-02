import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatService, ChatMessage } from '@/lib/chatService';
import { loadCachedMessages, saveCachedMessages } from '@/lib/chatCache';
import { connectivity } from '@/lib/connectivity';

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
const queueLocks = new Map<string, Promise<void>>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const retryAttempts = new Map<string, number>();
const queueRevisions = new Map<string, number>();
const RETRY_DELAYS_MS = [2000, 5000, 12000, 30000];

function cancelRetry(userId: string) {
    const timer = retryTimers.get(userId);
    if (timer) clearTimeout(timer);
    retryTimers.delete(userId);
}

function clearRetry(userId: string) {
    cancelRetry(userId);
    retryAttempts.delete(userId);
}

function scheduleRetry(userId: string) {
    if (!userId || connectivity.getSnapshot() === 'offline' || retryTimers.has(userId)) return;
    const attempt = retryAttempts.get(userId) || 0;
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
    retryAttempts.set(userId, attempt + 1);
    retryTimers.set(userId, setTimeout(() => {
        retryTimers.delete(userId);
        if (connectivity.getSnapshot() !== 'offline') void flushOfflineMessageQueue(userId);
    }, delay));
}

const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;

function withQueueLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    const previous = queueLocks.get(userId) || Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const tail = result.then(() => undefined, () => undefined);
    queueLocks.set(userId, tail);
    return result.finally(() => {
        if (queueLocks.get(userId) === tail) queueLocks.delete(userId);
    });
}

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
    await withQueueLock(item.userId, async () => {
        const current = (await readQueue(item.userId)).filter((queued) => !isExpired(queued));
        if (current.some((queued) => queued.tempId === item.tempId)) return;
        if (current.length >= MAX_ITEMS) throw new Error('offline_queue_full');
        await writeQueue(item.userId, [...current, item]);
        queueRevisions.set(item.userId, (queueRevisions.get(item.userId) || 0) + 1);
    });
    scheduleRetry(item.userId);
}

export async function queuedMessagesForConversation(userId: string, conversationId: string) {
    return withQueueLock(userId, async () => {
        const current = await readQueue(userId);
        const active = current.filter((item) => !isExpired(item));
        if (active.length !== current.length) await writeQueue(userId, active);
        return active.filter((item) => item.conversationId === conversationId);
    });
}

export async function clearOfflineMessageQueue(userId?: string | null) {
    if (userId) {
        clearRetry(userId);
        queueRevisions.delete(userId);
        await withQueueLock(userId, () => AsyncStorage.removeItem(keyFor(userId)));
        return;
    }
    for (const queuedUserId of retryTimers.keys()) clearRetry(queuedUserId);
    retryAttempts.clear();
    queueRevisions.clear();
    const keys = await AsyncStorage.getAllKeys();
    const matching = keys.filter((key) => key.startsWith(KEY_PREFIX));
    if (matching.length) await AsyncStorage.multiRemove(matching);
}

async function flush(userId: string): Promise<'empty' | 'retry' | 'blocked'> {
    const expired = await withQueueLock(userId, async () => {
        const queue = await readQueue(userId);
        const expiredItems = queue.filter(isExpired);
        if (expiredItems.length) await writeQueue(userId, queue.filter((item) => !isExpired(item)));
        return expiredItems;
    });
    for (const item of expired) {
        await persistFailedItem(item);
        emit({ type: 'failed', item, error: 'offline_message_expired' });
    }

    while (true) {
        const item = await withQueueLock(userId, async () => (await readQueue(userId))[0]);
        if (!item) return 'empty';
        const result = await chatService.send({
            conversationId: item.conversationId,
            content: item.content,
            type: 'text',
            replyTo: item.replyTo,
            clientMessageId: item.tempId,
        }).catch(() => ({ success: false, errorMessage: 'network_error' } as Awaited<ReturnType<typeof chatService.send>>));

        if (result.success && result.message) {
            retryAttempts.delete(userId);
            await withQueueLock(userId, async () => {
                const current = await readQueue(userId);
                await writeQueue(userId, current.filter((queued) => queued.tempId !== item.tempId));
            });
            emit({ type: 'sent', item, message: result.message });
            continue;
        }

        const error = result.errorMessage
            || (typeof result.message === 'string' ? result.message : '')
            || 'message_failed';
        if (error === 'network_error') return 'retry';
        if (result.code === 'MEMBERSHIP_REQUIRED' || error === 'membership_required') return 'blocked';

        await withQueueLock(userId, async () => {
            const current = await readQueue(userId);
            await writeQueue(userId, current.filter((queued) => queued.tempId !== item.tempId));
        });
        await persistFailedItem(item);
        emit({ type: 'failed', item, error });
    }
}

export function flushOfflineMessageQueue(userId: string) {
    if (!userId) return Promise.resolve();
    const existing = flushes.get(userId);
    if (existing) return existing;
    cancelRetry(userId);
    const startingRevision = queueRevisions.get(userId) || 0;
    const task = flush(userId)
        .catch(() => 'retry' as const)
        .then((outcome) => {
            if (outcome === 'retry') scheduleRetry(userId);
            else if (outcome === 'empty') {
                if ((queueRevisions.get(userId) || 0) !== startingRevision) scheduleRetry(userId);
                else clearRetry(userId);
            }
        })
        .finally(() => flushes.delete(userId));
    flushes.set(userId, task);
    return task;
}
