import { api, ApiResponse } from './api';

export type GalleryPrivacy = 'public' | 'private';

export type GalleryItem = {
    uuid: string;
    safe?: boolean;
    moderationMeta?: {
        status?: 'queued' | 'processing' | 'approved' | 'pending_review' | 'rejected' | 'skipped' | string;
        reasonCodes?: string[];
        queuedAt?: string;
        startedAt?: string;
        checkedAt?: string;
        reviewedAt?: string;
        updatedAt?: string;
    };
    isPrimary?: boolean;
    sort_index?: number;
    url?: string;
    urls?: {
        original?: string;
        avatar?: string;
        small?: string;
        thumb?: string;
        blur?: string;
    };
    [key: string]: any;
};

export interface GalleryResponse extends ApiResponse {
    privacy?: GalleryPrivacy;
    avatarUuid?: string | null;
    gallery?: GalleryItem[];
}

export interface GalleryUploadResponse extends ApiResponse {
    image?: GalleryItem;
    pendingReview?: boolean;
    moderationStatus?: string;
}

export const galleryService = {
    fetchMe: (): Promise<GalleryResponse> => api.get('/gallery/me'),
    upload: (formData: FormData): Promise<GalleryUploadResponse> => api.postFormData('/gallery', formData),
    remove: (uuid: string): Promise<ApiResponse> => api.delete(`/gallery/${uuid}`),
    reorder: (uuids: string[]): Promise<ApiResponse> => api.patch('/gallery/reorder', { uuids }),
    makePrimary: (uuid: string): Promise<ApiResponse> => api.patch(`/gallery/${uuid}`, { isPrimary: true }),
    updatePrivacy: (privacy: GalleryPrivacy): Promise<ApiResponse> => api.patch('/gallery/privacy', { privacy }),
    // Owner-driven private gallery reveal.
    createGrant: (body: { viewerId: string; conversationId?: string; scope?: 'all' | 'uuids'; uuids?: string[]; ttlHours?: number; noExpiry?: boolean }): Promise<ApiResponse> =>
        api.post('/gallery/grants', { scope: 'all', ...body }),
    revokeGrant: (grantId: string, conversationId?: string): Promise<ApiResponse> =>
        api.delete(`/gallery/grants/${encodeURIComponent(grantId)}${conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ''}`),
};
