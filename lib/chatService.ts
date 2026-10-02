import { api, ApiResponse } from './api';
import { chatRelationship } from './chatRelationship';

export type ConversationState =
    | 'request_pending'
    | 'active'
    | 'declined'
    | 'expired'
    | 'blocked'
    | 'ended';

export type MessageType = 'text' | 'image' | 'voice' | 'system';
export type ConversationTab = 'chats' | 'requests' | 'sent' | 'closed';

export type ConversationOtherUser = {
    id: string;
    _id?: string;
    username?: string | null;
    profileName?: string | null;
    avatar?: string | null;
    image?: string | null;
    profile_image?: string | null;
    account_deleted?: boolean;
    recently_active?: boolean;
};

export type GalleryRevealStatus = {
    canReveal: boolean;
    viewerId: string;
    myGrant: {
        id: string;
        expiresAt?: string | null;
    } | null;
};

export type Conversation = {
    id: string;
    _id?: string;
    state: ConversationState;
    requestRole?: 'incoming' | 'sent' | null;
    lastMessageAt: string | null;
    lastMessagePreview: string;
    lastMessageSender: string | null;
    unreadCount: number;
    muted?: boolean;
    otherUser?: ConversationOtherUser;
    from?: ConversationOtherUser;
    to?: ConversationOtherUser;
    createdAt?: string;
    requestExpiresAt?: string;
    galleryReveal?: GalleryRevealStatus | null;
};

export type MessageReaction = {
    user: string;
    emoji: string;
    createdAt: string;
};

export type MessageMedia = {
    localUri?: string;
    url?: string;
    key?: string;
    mime?: string;
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
    waveform?: number[];
    thumbnail?: string;
    thumbnailKey?: string;
    viewOnce?: boolean;
    viewedAt?: string | null;
};

export type ChatMessage = {
    id: string;
    _id?: string;
    conversationId: string;
    sender: string;
    type: MessageType;
    content?: string;
    text?: string;
    replyTo?: ChatMessage | string | null;
    media?: MessageMedia | null;
    linkPreview?: {
        url: string;
        title?: string;
        description?: string;
        image?: string;
    } | null;
    deliveredAt?: string | null;
    seenAt?: string | null;
    unsent?: boolean;
    unsentAt?: string | null;
    reactions?: MessageReaction[];
    createdAt: string;
    pending?: boolean;
    failed?: boolean;
    failureReason?: string;
    queued?: boolean;
    tempId?: string;
    clientMessageId?: string | null;
};

export interface ChatListResponse<T = Conversation> extends ApiResponse {
    items?: T[];
    nextCursor?: string | null;
    unreadCount?: number;
    count?: number;
}

export interface ChatSlotsResponse extends ApiResponse {
    used?: number;
    total?: number;
    available?: number;
}

export interface ChatStatusResponse extends ApiResponse {
    status?: 'none' | 'active' | 'pending' | 'other';
    relationshipStatus?: 'none' | 'active' | 'pending' | 'other';
    conversationId?: string | null;
    requestRole?: 'incoming' | 'sent' | null;
}

export interface SendMessageResponse extends Omit<ApiResponse, 'message'> {
    message?: ChatMessage;
    conversationId?: string;
    state?: ConversationState;
    errorMessage?: string;
}

export interface MediaUploadResponse extends ApiResponse {
    media?: MessageMedia;
}

const withQuery = (endpoint: string, params?: Record<string, string | number | boolean | null | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        search.set(key, String(value));
    });
    const qs = search.toString();
    return qs ? `${endpoint}?${qs}` : endpoint;
};

export function normalizeConversation(raw: any, requestRole?: 'incoming' | 'sent' | null): Conversation {
    const isSent = requestRole === 'sent';
    const rawOther = raw?.otherUser || (isSent ? raw?.to : raw?.from) || {};
    const otherId = String(rawOther?.id || rawOther?._id || rawOther?.user_id || rawOther?.userId || '');
    const otherUser: ConversationOtherUser = {
        ...rawOther,
        id: otherId,
        _id: rawOther?._id || otherId || undefined,
    };
    return {
        id: String(raw?.id || raw?._id || ''),
        _id: raw?._id,
        state: raw?.state || 'request_pending',
        requestRole: requestRole ?? raw?.requestRole ?? null,
        lastMessageAt: raw?.lastMessageAt || raw?.createdAt || null,
        lastMessagePreview: raw?.lastMessagePreview || '',
        lastMessageSender: raw?.lastMessageSender || null,
        unreadCount: Number(raw?.unreadCount || 0),
        muted: Boolean(raw?.muted),
        otherUser,
        from: raw?.from,
        to: raw?.to,
        createdAt: raw?.createdAt,
        requestExpiresAt: raw?.requestExpiresAt,
        galleryReveal: raw?.galleryReveal ?? null,
    };
}

export const chatService = {
    conversations: (params?: { cursor?: string | null; limit?: number }): Promise<ChatListResponse<Conversation>> =>
        api.get(withQuery('/chat/conversations', { cursor: params?.cursor || undefined, limit: params?.limit || 30 })),
    incomingRequests: (): Promise<ChatListResponse<Conversation>> => api.get('/chat/conversations/requests'),
    sentRequests: (): Promise<ChatListResponse<Conversation>> => api.get('/chat/conversations/requests/sent'),
    status: async (userId: string): Promise<ChatStatusResponse> => {
        const response = await api.get(`/chat/status/${encodeURIComponent(userId)}`) as ChatStatusResponse;
        if (!response.success) return response;
        const known = chatRelationship(response);
        if (known) return { ...response, status: known };
        if (!response.conversationId) return { ...response, success: false, message: 'connection_error' };
        // Older API deployments use `status` for the relationship state, which
        // the HTTP wrapper replaces with 200. Resolve ambiguous states by ID.
        const metadata = await chatService.conversation(response.conversationId);
        if (!metadata.success) return { ...response, success: false, message: metadata.message || 'connection_error' };
        const state = metadata.data?.state || (metadata as any).state;
        const resolved = chatRelationship(response, state);
        if (!resolved) return { ...response, success: false, message: 'connection_error' };
        return { ...response, status: resolved, requestRole: metadata.data?.requestRole || null };
    },
    conversation: async (conversationId: string): Promise<ApiResponse<Conversation>> => {
        const response = await api.get(`/chat/conversations/${encodeURIComponent(conversationId)}`) as ApiResponse<Conversation> & { id?: string; state?: string };
        const payload = response.data || response;
        // Older API deployments returned valid metadata without a success flag.
        if (!response.success && response.status >= 200 && response.status < 300 && payload?.id && payload?.state) {
            return { ...response, success: true, data: payload as Conversation };
        }
        return response;
    },
    messages: (conversationId: string, params?: { cursor?: string | null }): Promise<ChatListResponse<ChatMessage>> =>
        api.get(withQuery(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, { cursor: params?.cursor })),
    send: async (body: { recipientId?: string; conversationId?: string; content?: string; type?: MessageType; replyTo?: string; media?: MessageMedia; clientMessageId?: string }): Promise<SendMessageResponse> => {
        const res = await api.post('/chat/send', body);
        if (!res.success) {
            return { ...res, errorMessage: typeof res.message === 'string' ? res.message : undefined } as SendMessageResponse;
        }
        return res as SendMessageResponse;
    },
    uploadMedia: (body: FormData): Promise<MediaUploadResponse> => api.postFormData('/chat/media/upload', body),
    fetchViewOnce: (messageId: string): Promise<ApiResponse<{ url: string; expiresIn: number }> & { url?: string; expiresIn?: number }> =>
        api.get(`/chat/media/view-once/${encodeURIComponent(messageId)}`),
    markViewOnceViewed: (messageId: string): Promise<ApiResponse<{ viewedAt: string }> & { viewedAt?: string }> =>
        api.post(`/chat/media/view-once/${encodeURIComponent(messageId)}/viewed`, {}),
    accept: (conversationId: string): Promise<ApiResponse> => api.post(`/chat/conversations/${encodeURIComponent(conversationId)}/accept`, {}),
    decline: (conversationId: string): Promise<ApiResponse> => api.post(`/chat/conversations/${encodeURIComponent(conversationId)}/decline`, {}),
    withdraw: (conversationId: string): Promise<ApiResponse> => api.post(`/chat/conversations/${encodeURIComponent(conversationId)}/withdraw`, {}),
    markRead: (conversationId: string): Promise<ApiResponse> => api.post(`/chat/conversations/${encodeURIComponent(conversationId)}/read`, {}),
    mute: (conversationId: string, mute: boolean): Promise<ApiResponse> => api.post(`/chat/conversations/${encodeURIComponent(conversationId)}/mute`, { mute }),
    end: (conversationId: string): Promise<ApiResponse> => api.post(`/chat/conversations/${encodeURIComponent(conversationId)}/end`, {}),
    deleteConversation: (conversationId: string): Promise<ApiResponse> => api.post(`/chat/conversations/${encodeURIComponent(conversationId)}/delete`, {}),
    unsend: (messageId: string): Promise<ApiResponse> => api.post(`/chat/messages/${encodeURIComponent(messageId)}/unsend`, {}),
    deleteMessage: (messageId: string): Promise<ApiResponse> => api.delete(`/chat/messages/${encodeURIComponent(messageId)}/delete`),
    react: (messageId: string, emoji: string): Promise<ApiResponse> => api.post(`/chat/messages/${encodeURIComponent(messageId)}/react`, { emoji }),
    unreadCount: (): Promise<ChatListResponse> => api.get('/chat/unread-count'),
    slots: (): Promise<ChatSlotsResponse> => api.get('/chat/slots'),
};
