import { useEffect, useRef, useState } from 'react';
import { ChatSocketHandlers, chatSocket } from '@/lib/chatSocket';

type UseChatSocketOptions = ChatSocketHandlers & {
    enabled?: boolean;
};

/**
 * Subscribes to the shared chat socket (see lib/chatSocket.ts). Handlers are
 * kept in a ref so re-renders never reconnect; the subscription only cycles
 * when `enabled` flips.
 */
export function useChatSocket({ enabled = true, ...handlers }: UseChatSocketOptions) {
    const handlersRef = useRef<ChatSocketHandlers>(handlers);
    handlersRef.current = handlers;
    const [connected, setConnected] = useState(chatSocket.isConnected());

    useEffect(() => {
        if (!enabled) return;
        const unsubscribe = chatSocket.subscribe(() => handlersRef.current);
        const offConnection = chatSocket.onConnectionChange(setConnected);
        setConnected(chatSocket.isConnected());
        return () => {
            unsubscribe();
            offConnection();
        };
    }, [enabled]);

    const markSeen = (id?: string | null) => {
        chatSocket.markSeen(id);
    };

    const sendTyping = (recipientId?: string | null) => {
        chatSocket.sendTyping(handlersRef.current.conversationId, recipientId);
    };

    const stopTyping = (recipientId?: string | null) => {
        chatSocket.stopTyping(handlersRef.current.conversationId, recipientId);
    };

    return { connected, markSeen, sendTyping, stopTyping };
}
