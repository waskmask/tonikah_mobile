import { api, ApiResponse } from './api';

export interface UserListResponse extends ApiResponse {
    items?: any[];
    nextCursor?: string | null;
    hasMore?: boolean;
    total?: number;
}

const withQuery = (endpoint: string, params: Record<string, string | number | undefined | null>) => {
    const query = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');
    return query ? `${endpoint}?${query}` : endpoint;
};

export const usersService = {
    list: (params: Record<string, string | number | undefined | null> = {}): Promise<UserListResponse> =>
        api.get(withQuery('/users/list', params)),
    favorites: (params: Record<string, string | number | undefined | null> = {}): Promise<UserListResponse> =>
        api.get(withQuery('/users/me/favorites', params)),
    blocked: (params: Record<string, string | number | undefined | null> = {}): Promise<UserListResponse> =>
        api.get(withQuery('/users/me/blocked', params)),
    visitors: (params: Record<string, string | number | undefined | null> = {}): Promise<UserListResponse> =>
        api.get(withQuery('/users/me/visitors', params)),
    visited: (params: Record<string, string | number | undefined | null> = {}): Promise<UserListResponse> =>
        api.get(withQuery('/users/me/visited', params)),
    detail: (id: string): Promise<ApiResponse> => api.get(`/users/${id}`),
    favorite: (id: string): Promise<ApiResponse> => api.post(`/users/${id}/favorite`, {}),
    unfavorite: (id: string): Promise<ApiResponse> => api.delete(`/users/${id}/favorite`),
    skip: (id: string): Promise<ApiResponse> => api.post(`/users/${id}/skip`, {}),
    block: (id: string): Promise<ApiResponse> => api.post(`/users/${id}/block`, {}),
    unblock: (id: string): Promise<ApiResponse> => api.delete(`/users/${id}/block`),
    markViewed: (id: string): Promise<ApiResponse> => api.post(`/users/${id}/view`, {}),
};
