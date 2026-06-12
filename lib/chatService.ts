import { api, ApiResponse } from './api';

export interface ChatListResponse extends ApiResponse {
    items?: any[];
    nextCursor?: string | null;
    unreadCount?: number;
    count?: number;
}

export const chatService = {
    conversations: (): Promise<ChatListResponse> => api.get('/chat/conversations'),
    incomingRequests: (): Promise<ChatListResponse> => api.get('/chat/conversations/requests'),
    sentRequests: (): Promise<ChatListResponse> => api.get('/chat/conversations/requests/sent'),
    messages: (conversationId: string): Promise<ChatListResponse> => api.get(`/chat/conversations/${conversationId}/messages`),
    send: (body: { recipientId?: string; conversationId?: string; content: string }): Promise<ApiResponse> =>
        api.post('/chat/send', body),
    accept: (conversationId: string): Promise<ApiResponse> => api.post(`/chat/conversations/${conversationId}/accept`, {}),
    decline: (conversationId: string): Promise<ApiResponse> => api.post(`/chat/conversations/${conversationId}/decline`, {}),
    unreadCount: (): Promise<ChatListResponse> => api.get('/chat/unread-count'),
};
