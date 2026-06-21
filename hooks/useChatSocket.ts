import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Config } from '@/constants/config';
import { api } from '@/lib/api';
import { ChatMessage } from '@/lib/chatService';

type ChatSocketHandlers = {
    conversationId?: string | null;
    enabled?: boolean;
    onMessage?: (message: ChatMessage, payload: any) => void;
    onMessageUnsent?: (messageId: string, payload: any) => void;
    onMessageUpdated?: (payload: any) => void;
    onConversationChanged?: (payload: any) => void;
    onUnread?: (payload: any) => void;
    onSeen?: (payload: any) => void;
    onDelivered?: (payload: any) => void;
    onViewOnceViewed?: (payload: any) => void;
};

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

export function useChatSocket({
    conversationId,
    enabled = true,
    onMessage,
    onMessageUnsent,
    onMessageUpdated,
    onConversationChanged,
    onUnread,
    onSeen,
    onDelivered,
    onViewOnceViewed,
}: ChatSocketHandlers) {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const refreshingSocketRef = useRef(false);

    useEffect(() => {
        let disposed = false;

        const start = async () => {
            if (!enabled) return;
            const { accessToken } = await api.getTokens();
            if (!accessToken || disposed) return;

            const socket = io(socketBaseUrl(), {
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

            socketRef.current = socket;

            socket.on('connect', () => {
                refreshingSocketRef.current = false;
                setConnected(true);
            });
            socket.on('disconnect', () => setConnected(false));
            socket.on('connect_error', async (error) => {
                setConnected(false);
                const message = String(error?.message || '');
                if (!/(auth|token)/i.test(message) || refreshingSocketRef.current) return;

                refreshingSocketRef.current = true;
                const refreshed = await api.refreshAccessToken();
                if (!refreshed || disposed) {
                    refreshingSocketRef.current = false;
                    return;
                }

                socket.auth = { token: refreshed };
                socket.io.opts.extraHeaders = {
                    ...(socket.io.opts.extraHeaders || {}),
                    Cookie: `app_at=${refreshed}`,
                    Authorization: `Bearer ${refreshed}`,
                };
                socket.connect();
            });

            socket.on('chat:message', (payload) => {
                const message = normalizeMessage(payload?.message || payload);
                if (conversationId && String(payload?.conversationId || message.conversationId) !== String(conversationId)) {
                    onConversationChanged?.(payload);
                    return;
                }
                if (message.id) {
                    socket.emit('chat:delivered', { messageId: message.id });
                }
                onMessage?.(message, payload);
                onConversationChanged?.(payload);
            });

            socket.on('chat:message:unsent', (payload) => {
                onMessageUnsent?.(String(payload?.messageId || ''), payload);
                onConversationChanged?.(payload);
            });

            socket.on('chat:message:updated', (payload) => {
                onMessageUpdated?.(payload);
                onConversationChanged?.(payload);
            });
            socket.on('chat:message:reaction', (payload) => {
                onMessageUpdated?.(payload);
                onConversationChanged?.(payload);
            });
            socket.on('chat:viewonce:viewed', (payload) => {
                onViewOnceViewed?.(payload);
                onConversationChanged?.(payload);
            });
            socket.on('chat:request', (payload) => onConversationChanged?.(payload));
            socket.on('chat:request:accepted', (payload) => onConversationChanged?.(payload));
            socket.on('chat:conversation:ended', (payload) => onConversationChanged?.(payload));
            socket.on('chat:seen', (payload) => onSeen?.(payload));
            socket.on('chat:delivered', (payload) => onDelivered?.(payload));
            socket.on('chat:unread', (payload) => onUnread?.(payload));
        };

        start();

        return () => {
            disposed = true;
            setConnected(false);
            socketRef.current?.disconnect();
            socketRef.current = null;
        };
    }, [
        conversationId,
        enabled,
        onConversationChanged,
        onDelivered,
        onMessage,
        onMessageUnsent,
        onMessageUpdated,
        onSeen,
        onUnread,
        onViewOnceViewed,
    ]);

    const markSeen = (id?: string | null) => {
        if (id) socketRef.current?.emit('chat:seen', { conversationId: id });
    };

    const sendTyping = (recipientId?: string | null) => {
        if (conversationId && recipientId) {
            socketRef.current?.emit('chat:typing', { conversationId, recipientId });
        }
    };

    const stopTyping = (recipientId?: string | null) => {
        if (conversationId && recipientId) {
            socketRef.current?.emit('chat:stop-typing', { conversationId, recipientId });
        }
    };

    return { connected, markSeen, sendTyping, stopTyping };
}
