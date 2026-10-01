import type { Conversation, ConversationState } from '@/lib/chatService';
import { storage } from '@/lib/storage';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

export type CachedInbox = {
    conversations: Conversation[];
    requests: Conversation[];
    sent: Conversation[];
    nextCursor: string | null;
    slots: { used?: number; total?: number } | null;
    recentlyAcceptedId?: string;
};

export function applyAcceptedConversation(conversation: Conversation) {
    const active: Conversation = { ...conversation, state: 'active', requestRole: null };
    queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, (current) => {
        if (!current) return undefined;
        const wasPending = [...current.requests, ...current.sent].some((item) => item.id === active.id)
            || current.conversations.some((item) => item.id === active.id && item.state === 'request_pending');
        return {
            ...current,
            conversations: [active, ...current.conversations.filter((item) => item.id !== active.id)],
            requests: current.requests.filter((item) => item.id !== active.id),
            sent: current.sent.filter((item) => item.id !== active.id),
            recentlyAcceptedId: active.id,
            slots: wasPending && current.slots?.used !== undefined
                ? { ...current.slots, used: current.slots.used + 1 }
                : current.slots,
        };
    });
}

export function applyAcceptedConversationById(conversationId: string): boolean {
    const current = queryClient.getQueryData<CachedInbox>(queryKeys.chat.inbox);
    const known = current?.conversations.find((item) => item.id === conversationId)
        || current?.requests.find((item) => item.id === conversationId)
        || current?.sent.find((item) => item.id === conversationId);
    if (!known) return false;
    applyAcceptedConversation(known);
    return true;
}

export function applyOutgoingRequest(conversationId: string, otherUserId: string, name: string) {
    queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, (current) => {
        if (!current) return undefined;
        const previous = [...current.sent, ...current.conversations].find((item) => item.id === conversationId);
        const pending: Conversation = {
            id: conversationId,
            state: 'request_pending',
            requestRole: 'sent',
            lastMessageAt: new Date().toISOString(),
            lastMessagePreview: previous?.lastMessagePreview || '',
            lastMessageSender: previous?.lastMessageSender || null,
            unreadCount: 0,
            otherUser: previous?.otherUser || { id: otherUserId, profileName: name },
        };
        return {
            ...current,
            conversations: current.conversations.filter((item) => item.id !== conversationId),
            requests: current.requests.filter((item) => item.id !== conversationId),
            sent: [pending, ...current.sent.filter((item) => item.id !== conversationId)],
        };
    });
}

export function applyConversationStateById(conversationId: string, state: ConversationState) {
    queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, (current) => {
        if (!current) return undefined;
        const wasActive = current.conversations.some((item) => item.id === conversationId && item.state === 'active');
        return {
            ...current,
            conversations: current.conversations.map((item) => item.id === conversationId ? { ...item, state } : item),
            requests: current.requests.filter((item) => item.id !== conversationId),
            sent: current.sent.filter((item) => item.id !== conversationId),
            slots: wasActive && state === 'ended' && current.slots?.used !== undefined
                ? { ...current.slots, used: Math.max(0, current.slots.used - 1) }
                : current.slots,
        };
    });
}

export function markCachedConversationRead(conversationId: string, unreadHint = 0, userId = '') {
    const current = queryClient.getQueryData<CachedInbox>(queryKeys.chat.inbox);
    const cachedUnread = [...(current?.conversations || []), ...(current?.requests || [])]
        .find((item) => item.id === conversationId)?.unreadCount || 0;
    const clearedCount = Math.max(cachedUnread, unreadHint);
    if (current) {
        const updated: CachedInbox = {
            ...current,
            conversations: current.conversations.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item),
            requests: current.requests.map((item) => item.id === conversationId ? { ...item, unreadCount: 0 } : item),
        };
        queryClient.setQueryData<CachedInbox>(queryKeys.chat.inbox, updated);
        if (userId) void saveCachedInbox(userId, updated).catch(() => undefined);
    }
    return clearedCount;
}

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

export async function clearCachedInbox(userId: string): Promise<void> {
    if (!userId) return;
    await storage.removeItem(keyFor(userId));
}
