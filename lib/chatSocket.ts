import { io, Socket } from 'socket.io-client';
import { Config } from '@/constants/config';
import { api } from '@/lib/api';
import { ChatMessage } from '@/lib/chatService';
import type { GalleryModerationUpdateEvent } from '@/hooks/useGalleryModeration';
import { queryClient } from '@/lib/queryClient';
import { CURRENT_USER_STATUS_QUERY_KEY, type CurrentUserStatus } from '@/hooks/useCurrentUserStatus';
import { clearAllCachedMessages } from '@/lib/chatCache';
import { clearChatMediaCache } from '@/lib/chatMediaCache';
import { useAuthStore } from '@/store/authStore';

/**
 * Singleton chat socket. Previously every useChatSocket() call opened its own
 * connection (conversation + messages tab + bottom bar = 3 sockets). One shared
 * connection now fans events out to registered subscribers; it connects when
 * the first subscriber registers and disconnects shortly after the last one
 * leaves (i.e. on logout, when the tabs unmount).
 */

export type ChatSocketHandlers = {
    conversationId?: string | null;
    onMessage?: (message: ChatMessage, payload: any) => void;
    onMessageUnsent?: (messageId: string, payload: any) => void;
    onMessageUpdated?: (payload: any) => void;
    onConversationChanged?: (payload: any) => void;
    onUnread?: (payload: any) => void;
    onSeen?: (payload: any) => void;
    onDelivered?: (payload: any) => void;
    onViewOnceViewed?: (payload: any) => void;
    onTyping?: (payload: any) => void;
    onStopTyping?: (payload: any) => void;
    onGalleryAccessChanged?: (payload: any) => void;
    onGalleryModerationUpdated?: (payload: GalleryModerationUpdateEvent) => void;
};

type Subscriber = { handlers: () => ChatSocketHandlers };

function socketBaseUrl() {
    return Config.API_URL.replace(/\/api\/?$/, '');
}

function normalizeMessage(raw: any): ChatMessage {
    return {
        ...raw,
        id: String(raw?.id || raw?._id || raw?.tempId || ''),
        conversationId: String(raw?.conversationId || ''),
        sender: String(raw?.sender || raw?.senderId || ''),
        type: raw?.type || 'text',
        reactions: raw?.reactions || [],
        createdAt: raw?.createdAt || new Date().toISOString(),
    };
}

let socket: Socket | null = null;
let connecting = false;
let refreshingAuth = false;
let connected = false;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

const subscribers = new Set<Subscriber>();
const connectionListeners = new Set<(value: boolean) => void>();

function setConnected(value: boolean) {
    if (connected === value) return;
    connected = value;
    connectionListeners.forEach((listener) => listener(value));
}

function matchesConversation(handlers: ChatSocketHandlers, payload: any, fallbackId?: string) {
    if (!handlers.conversationId) return true;
    const incoming = String(payload?.conversationId || fallbackId || '');
    return !incoming || incoming === String(handlers.conversationId);
}

function broadcast(callback: (handlers: ChatSocketHandlers) => void) {
    for (const subscriber of subscribers) {
        callback(subscriber.handlers());
    }
}

async function ensureSocket() {
    if (socket || connecting) return;
    connecting = true;
    try {
        const { accessToken } = await api.getTokens();
        if (!accessToken || socket || subscribers.size === 0) return;

        const nextSocket = io(socketBaseUrl(), {
            transports: ['websocket', 'polling'],
            auth: { token: accessToken },
            extraHeaders: {
                Cookie: `app_at=${accessToken}`,
                Authorization: `Bearer ${accessToken}`,
                'X-Client-Type': 'native',
            },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 900,
            reconnectionDelayMax: 5000,
            timeout: 12000,
        });
        socket = nextSocket;

        nextSocket.on('connect', () => {
            refreshingAuth = false;
            setConnected(true);
        });
        nextSocket.on('disconnect', () => setConnected(false));
        nextSocket.on('session:revoked', () => {
            teardownSocket();
            void api.handleUnauthorized();
        });
        nextSocket.on('connect_error', async (error) => {
            setConnected(false);
            const message = String(error?.message || '');
            if (!/(auth|token)/i.test(message) || refreshingAuth) return;

            refreshingAuth = true;
            const refreshed = await api.refreshAccessToken();
            if (!refreshed || socket !== nextSocket) {
                refreshingAuth = false;
                return;
            }

            nextSocket.auth = { token: refreshed };
            nextSocket.io.opts.extraHeaders = {
                ...(nextSocket.io.opts.extraHeaders || {}),
                Cookie: `app_at=${refreshed}`,
                Authorization: `Bearer ${refreshed}`,
            };
            nextSocket.connect();
        });

        nextSocket.on('chat:message', (payload) => {
            const message = normalizeMessage(payload?.message || payload);
            // Ack delivery once for the device (previously each hook emitted it).
            if (message.id) {
                nextSocket.emit('chat:delivered', { messageId: message.id });
            }
            broadcast((handlers) => {
                if (!matchesConversation(handlers, payload, message.conversationId)) {
                    handlers.onConversationChanged?.(payload);
                    return;
                }
                handlers.onMessage?.(message, payload);
                handlers.onConversationChanged?.(payload);
            });
        });

        nextSocket.on('chat:message:unsent', (payload) => {
            broadcast((handlers) => {
                handlers.onMessageUnsent?.(String(payload?.messageId || ''), payload);
                handlers.onConversationChanged?.(payload);
            });
        });

        const forwardUpdated = (payload: any) => {
            broadcast((handlers) => {
                handlers.onMessageUpdated?.(payload);
                handlers.onConversationChanged?.(payload);
            });
        };
        nextSocket.on('chat:message:updated', forwardUpdated);
        nextSocket.on('chat:message:reaction', forwardUpdated);

        nextSocket.on('chat:viewonce:viewed', (payload) => {
            broadcast((handlers) => {
                handlers.onViewOnceViewed?.(payload);
                handlers.onConversationChanged?.(payload);
            });
        });

        const forwardConversationChanged = (payload: any) => {
            broadcast((handlers) => handlers.onConversationChanged?.(payload));
        };
        nextSocket.on('chat:request', forwardConversationChanged);
        nextSocket.on('chat:request:accepted', forwardConversationChanged);
        nextSocket.on('chat:conversation:ended', forwardConversationChanged);

        const forwardGalleryAccessChanged = (payload: any) => {
            broadcast((handlers) => {
                handlers.onGalleryAccessChanged?.(payload);
                handlers.onConversationChanged?.(payload);
            });
        };
        nextSocket.on('gallery:access:granted', forwardGalleryAccessChanged);
        nextSocket.on('gallery:access:revoked', forwardGalleryAccessChanged);
        nextSocket.on('gallery:moderation-updated', (payload: GalleryModerationUpdateEvent) => {
            broadcast((handlers) => handlers.onGalleryModerationUpdated?.(payload));
        });

        nextSocket.on('chat:message:locked', (payload) => {
            broadcast((handlers) => handlers.onConversationChanged?.(payload));
        });

        nextSocket.on('membership:changed', (payload) => {
            const messagingAccess = payload?.messagingAccess;
            queryClient.setQueryData<CurrentUserStatus>(CURRENT_USER_STATUS_QUERY_KEY, (current) => ({
                ...(current || {}),
                messagingAccess,
            }));
            void queryClient.invalidateQueries({ queryKey: CURRENT_USER_STATUS_QUERY_KEY });
            if (messagingAccess?.allowed === false) {
                const user = useAuthStore.getState().user;
                const userId = String(user?._id || user?.id || '');
                queryClient.removeQueries({ queryKey: ['chat'] });
                void Promise.all([clearAllCachedMessages(userId), clearChatMediaCache()]);
            }
        });

        nextSocket.on('chat:seen', (payload) => broadcast((handlers) => handlers.onSeen?.(payload)));
        nextSocket.on('chat:delivered', (payload) => broadcast((handlers) => handlers.onDelivered?.(payload)));
        nextSocket.on('chat:unread', (payload) => broadcast((handlers) => handlers.onUnread?.(payload)));

        nextSocket.on('chat:typing', (payload) => {
            broadcast((handlers) => {
                if (matchesConversation(handlers, payload)) handlers.onTyping?.(payload);
            });
        });
        nextSocket.on('chat:stop-typing', (payload) => {
            broadcast((handlers) => {
                if (matchesConversation(handlers, payload)) handlers.onStopTyping?.(payload);
            });
        });
    } finally {
        connecting = false;
    }
}

function teardownSocket() {
    if (!socket) return;
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    setConnected(false);
}

export const chatSocket = {
    subscribe(handlers: () => ChatSocketHandlers): () => void {
        const subscriber: Subscriber = { handlers };
        subscribers.add(subscriber);
        if (disconnectTimer) {
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
        }
        void ensureSocket();
        return () => {
            subscribers.delete(subscriber);
            if (subscribers.size === 0) {
                // Grace period so quick screen transitions don't cycle the connection.
                disconnectTimer = setTimeout(() => {
                    disconnectTimer = null;
                    if (subscribers.size === 0) teardownSocket();
                }, 4000);
            }
        };
    },

    onConnectionChange(listener: (value: boolean) => void): () => void {
        connectionListeners.add(listener);
        return () => {
            connectionListeners.delete(listener);
        };
    },

    isConnected() {
        return connected;
    },

    markSeen(conversationId?: string | null) {
        if (conversationId) socket?.emit('chat:seen', { conversationId });
    },

    sendTyping(conversationId?: string | null, recipientId?: string | null) {
        if (conversationId && recipientId) {
            socket?.emit('chat:typing', { conversationId, recipientId });
        }
    },

    stopTyping(conversationId?: string | null, recipientId?: string | null) {
        if (conversationId && recipientId) {
            socket?.emit('chat:stop-typing', { conversationId, recipientId });
        }
    },
};
