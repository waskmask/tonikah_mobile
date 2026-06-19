import { api, ApiResponse } from './api';

export type GalleryPrivacy = 'public' | 'private';

export type GalleryItem = {
    uuid: string;
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

export const galleryService = {
    fetchMe: (): Promise<GalleryResponse> => api.get('/gallery/me'),
    upload: (formData: FormData): Promise<ApiResponse> => api.postFormData('/gallery', formData),
    remove: (uuid: string): Promise<ApiResponse> => api.delete(`/gallery/${uuid}`),
    reorder: (uuids: string[]): Promise<ApiResponse> => api.patch('/gallery/reorder', { uuids }),
    makePrimary: (uuid: string): Promise<ApiResponse> => api.patch(`/gallery/${uuid}`, { isPrimary: true }),
    updatePrivacy: (privacy: GalleryPrivacy): Promise<ApiResponse> => api.patch('/gallery/privacy', { privacy }),
};
