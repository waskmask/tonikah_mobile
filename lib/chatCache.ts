import { storage } from '@/lib/storage';
import type { ChatMessage } from '@/lib/chatService';

/**
 * Lightweight local cache for the most recent messages of a conversation.
 *
 * Goal: when a chat is opened, render the cached messages instantly (already at
 * the latest message, no spinner) while the network refresh happens in the
 * background — the WhatsApp/Telegram "instant open" feel.
 */

const MAX_CACHED_MESSAGES = 50;

const keyFor = (userId: string, conversationId: string) =>
    `chat:msgs:${userId}:${conversationId}`;

function sortAscending(messages: ChatMessage[]): ChatMessage[] {
    return [...messages].sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt)),
    );
}

export async function loadCachedMessages(
    userId: string,
    conversationId: string,
): Promise<ChatMessage[] | null> {
    if (!userId || !conversationId || conversationId === 'new') return null;
    const data = await storage.getItem(keyFor(userId, conversationId));
    if (!Array.isArray(data) || data.length === 0) return null;
    return data as ChatMessage[];
}

export async function saveCachedMessages(
    userId: string,
    conversationId: string,
    messages: ChatMessage[],
): Promise<void> {
    if (!userId || !conversationId || conversationId === 'new') return;
    // Keep only the newest slice — older history is fetched on demand via pagination.
    const trimmed = sortAscending(
        messages.filter((m) => m && !m.pending && !m.failed && m.id && !String(m.id).startsWith('tmp_')),
    ).slice(-MAX_CACHED_MESSAGES);
    if (trimmed.length === 0) return;
    await storage.setItem(keyFor(userId, conversationId), trimmed);
}

export async function clearCachedMessages(
    userId: string,
    conversationId: string,
): Promise<void> {
    if (!userId || !conversationId) return;
    await storage.removeItem(keyFor(userId, conversationId));
}
