import type { Conversation } from '@/lib/chatService';
import { storage } from '@/lib/storage';

export type CachedInbox = {
    conversations: Conversation[];
    requests: Conversation[];
    sent: Conversation[];
    nextCursor: string | null;
    slots: { used?: number; total?: number } | null;
};

const keyFor = (userId: string) => `chat:inbox:${userId}`;

export async function loadCachedInbox(userId: string): Promise<CachedInbox | null> {
    if (!userId) return null;
    const value = await storage.getItem(keyFor(userId));
    if (!value || !Array.isArray(value.conversations)) return null;
    return value as CachedInbox;
}

export async function saveCachedInbox(userId: string, inbox: CachedInbox): Promise<void> {
    if (!userId) return;
    await storage.setItem(keyFor(userId), {
        ...inbox,
        conversations: inbox.conversations.slice(0, 30),
        requests: inbox.requests.slice(0, 30),
        sent: inbox.sent.slice(0, 30),
    });
}
