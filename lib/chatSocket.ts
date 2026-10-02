import { io, Socket } from 'socket.io-client';
import { AppState, type NativeEventSubscription } from 'react-native';
import { Config } from '@/constants/config';
import { api } from '@/lib/api';
import { ChatMessage, type ConversationState } from '@/lib/chatService';
import type { GalleryModerationUpdateEvent } from '@/hooks/useGalleryModeration';
import { queryClient } from '@/lib/queryClient';
import { CURRENT_USER_STATUS_QUERY_KEY, type CurrentUserStatus } from '@/hooks/useCurrentUserStatus';
import { withMessagingAccessClock } from '@/lib/messagingAccess';
import { applyAcceptedConversationById, applyConversationStateById } from '@/lib/chatInboxCache';
import { useAuthStore } from '@/store/authStore';
import { deleteCachedChatMediaForMessage } from '@/lib/chatMediaCache';
import { markCachedMessageUnsent, removeCachedMessageForUser } from '@/lib/chatCache';
import { stopChatAudioPlaybackForMessage } from '@/lib/chatAudioPlayback';

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
    onMessageDeleted?: (messageId: string, payload: any) => void;
    onMessageUpdated?: (payload: any) => void;
    onConversationChanged?: (payload: any) => void;
    onRequestAccepted?: (payload: any) => void;
    onConversationState?: (payload: any) => void;
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

function isBackgrounded() {
    return AppState.currentState === 'background';
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
let appStateSubscription: NativeEventSubscription | null = null;

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
    if (socket || connecting || isBackgrounded()) return;
    connecting = true;
    try {
        const { accessToken, refreshToken } = await api.getTokens();
        if (!accessToken || socket || subscribers.size === 0 || isBackgrounded()) return;

        const nextSocket = io(socketBaseUrl(), {
            transports: ['websocket', 'polling'],
            // Refresh token identifies this particular native session so the
            // server can revoke other devices without disconnecting this one.
            auth: { token: accessToken, refreshToken },
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

            const refreshedTokens = await api.getTokens();
            nextSocket.auth = {
                token: refreshed,
                refreshToken: refreshedTokens.refreshToken,
            };
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
                if (!handlers.conversationId) handlers.onConversationChanged?.(payload);
            });
        });

        nextSocket.on('chat:message:unsent', (payload) => {
            const messageId = String(payload?.messageId || '');
            const conversationId = String(payload?.conversationId || '');
            const user = useAuthStore.getState().user;
            const userId = String(user?._id || user?.id || '');
            if (messageId && conversationId && userId) {
                stopChatAudioPlaybackForMessage(messageId);
                void Promise.allSettled([
                    deleteCachedChatMediaForMessage({ userId, conversationId, messageId }),
                    markCachedMessageUnsent(userId, conversationId, messageId),
                ]);
            }
            broadcast((handlers) => {
                if (matchesConversation(handlers, payload)) handlers.onMessageUnsent?.(messageId, payload);
                if (!handlers.conversationId) handlers.onConversationChanged?.(payload);
            });
        });

        nextSocket.on('chat:message:deleted-for-me', (payload) => {
            const messageId = String(payload?.messageId || '');
            const conversationId = String(payload?.conversationId || '');
            const user = useAuthStore.getState().user;
            const userId = String(user?._id || user?.id || '');
            if (messageId && conversationId && userId) {
                stopChatAudioPlaybackForMessage(messageId);
                void Promise.allSettled([
                    deleteCachedChatMediaForMessage({ userId, conversationId, messageId }),
                    removeCachedMessageForUser(userId, conversationId, messageId),
                ]);
            }
            broadcast((handlers) => {
                if (matchesConversation(handlers, payload)) handlers.onMessageDeleted?.(messageId, payload);
                if (!handlers.conversationId) handlers.onConversationChanged?.(payload);
            });
        });

        const forwardUpdated = (payload: any) => {
            broadcast((handlers) => {
                if (matchesConversation(handlers, payload)) handlers.onMessageUpdated?.(payload);
                if (!handlers.conversationId) handlers.onConversationChanged?.(payload);
            });
        };
        nextSocket.on('chat:message:updated', forwardUpdated);
        nextSocket.on('chat:message:reaction', forwardUpdated);

        nextSocket.on('chat:viewonce:viewed', (payload) => {
            broadcast((handlers) => {
                handlers.onViewOnceViewed?.(payload);
                if (!handlers.conversationId) handlers.onConversationChanged?.(payload);
            });
        });

        const forwardConversationChanged = (payload: any) => {
            broadcast((handlers) => handlers.onConversationChanged?.(payload));
        };
        nextSocket.on('chat:request', forwardConversationChanged);
        nextSocket.on('chat:request:accepted', (payload) => {
            const updated = applyAcceptedConversationById(String(payload?.conversationId || ''));
            broadcast((handlers) => {
                handlers.onRequestAccepted?.(payload);
                if (!updated) handlers.onConversationChanged?.(payload);
            });
        });
        nextSocket.on('chat:conversation:ended', forwardConversationChanged);
        nextSocket.on('chat:conversation:state', (payload) => {
            const id = String(payload?.conversationId || '');
            const state = String(payload?.state || '');
            if (!id || !['active', 'ended', 'declined', 'expired', 'blocked'].includes(state)) return;
            applyConversationStateById(id, state as ConversationState);
            broadcast((handlers) => handlers.onConversationState?.(payload));
        });

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
            const messagingAccess = payload?.messagingAccess
                ? withMessagingAccessClock(payload.messagingAccess)
                : undefined;
            queryClient.setQueryData<CurrentUserStatus>(CURRENT_USER_STATUS_QUERY_KEY, (current) => ({
                ...(current || {}),
                messagingAccess,
            }));
            void queryClient.invalidateQueries({ queryKey: CURRENT_USER_STATUS_QUERY_KEY });
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
        if (!appStateSubscription) {
            appStateSubscription = AppState.addEventListener('change', (state) => {
                if (state === 'background') {
                    socket?.disconnect();
                    setConnected(false);
                } else if (state === 'active' && subscribers.size > 0) {
                    if (socket) socket.connect();
                    else void ensureSocket();
                }
            });
        }
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
                    if (subscribers.size === 0) {
                        teardownSocket();
                        appStateSubscription?.remove();
                        appStateSubscription = null;
                    }
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
