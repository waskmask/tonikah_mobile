import { Config } from '@/constants/config';
import * as SecureStore from 'expo-secure-store';
import i18n from '@/lib/i18n';
import { Platform } from 'react-native';

const TOKEN_KEYS = {
    ACCESS: 'tn_access_token',
    REFRESH: 'tn_refresh_token',
};

// API Response interface
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    [key: string]: any; // Catch-all for extra top-level fields like `user` or `accessToken`
}

let isRefreshing = false;
let refreshSubscribers: ((accessToken: string) => void)[] = [];

const onRefreshed = (accessToken: string) => {
    refreshSubscribers.map(cb => cb(accessToken));
    refreshSubscribers = [];
};

const addRefreshSubscriber = (cb: (accessToken: string) => void) => {
    refreshSubscribers.push(cb);
};

const getClientHeaders = () => {
    const clientPlatform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

    return {
        'X-Client-Type': clientPlatform === 'web' ? 'web' : 'native',
        'X-Client-Platform': clientPlatform,
    };
};

// Extends RequestInit with our custom options
interface FetchOptions extends RequestInit {
    timeout?: number;
}

const performFetch = async (endpoint: string, options: FetchOptions = {}): Promise<Response> => {
    const { timeout = 15000, headers: customHeaders, ...restOptions } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const accessToken = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);

    const isFormDataBody =
        typeof FormData !== 'undefined' && restOptions.body instanceof FormData;

    const headers: Record<string, string> = {
        'Accept-Language': i18n.language,
        ...getClientHeaders(),
        ...(customHeaders as Record<string, string>),
    };

    if (!isFormDataBody && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const url = `${Config.API_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...restOptions,
            headers,
            signal: controller.signal,
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('timeout');
        }
        throw error;
    }
};

const handleResponse = async (response: Response, endpoint: string, options: FetchOptions): Promise<ApiResponse> => {
    // If 401 Unauthorized, handle token refresh logic
    if (response.status === 401 && endpoint !== '/app-user/mobile/refresh' && endpoint !== '/app-user/mobile/login') {
        const refreshToken = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);

        if (refreshToken) {
            if (!isRefreshing) {
                isRefreshing = true;

                try {
                    const refreshRes = await fetch(`${Config.API_URL}/app-user/mobile/refresh`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getClientHeaders(),
                        },
                        body: JSON.stringify({ refreshToken }),
                    });

                    const refreshData = await refreshRes.json();

                    if (refreshData.success && refreshData.accessToken) {
                        await api.setTokens(refreshData.accessToken, refreshData.refreshToken || refreshToken);
                        isRefreshing = false;
                        onRefreshed(refreshData.accessToken);

                        // Re-attempt original request
                        return apiRequest(endpoint, options);
                    } else {
                        // Refresh failed, clear tokens
                        await api.clearTokens();
                        isRefreshing = false;
                        // Let the auth store handle state update when it fails to fetch `me` next time or propagate up
                        return { success: false, message: 'unauthorized', status: 401 };
                    }
                } catch (e) {
                    await api.clearTokens();
                    isRefreshing = false;
                    return { success: false, message: 'unauthorized', status: 401 };
                }
            } else {
                // Wait for refresh to complete, then retry original request
                return new Promise((resolve) => {
                    addRefreshSubscriber((token) => {
                        // we don't pass the token explicitly in options since `performFetch` reads it fresh from secure store
                        resolve(apiRequest(endpoint, options));
                    });
                });
            }
        } else {
            await api.clearTokens();
            return { success: false, message: 'unauthorized', status: 401 };
        }
    }

    try {
        const data = await response.json();
        return { ...data, status: response.status };
    } catch (e) {
        return { success: false, message: 'invalid_json', status: response.status };
    }
};

const apiRequest = async (endpoint: string, options: FetchOptions = {}): Promise<ApiResponse> => {
    try {
        const response = await performFetch(endpoint, options);
        return handleResponse(response, endpoint, options);
    } catch (error: any) {
        if (error.message === 'timeout') {
            return { success: false, message: 'network_error', error: 'timeout' };
        }
        return { success: false, message: 'network_error' };
    }
};

const parseApiResponseText = (text: string, status: number): ApiResponse => {
    try {
        const data = text ? JSON.parse(text) : {};
        return { ...data, status };
    } catch {
        return { success: false, message: 'invalid_json', status, raw: text };
    }
};

const formDataRequest = async (endpoint: string, body: FormData, timeout = 90000): Promise<ApiResponse> => {
    const accessToken = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
    const url = `${Config.API_URL}${endpoint}`;

    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.timeout = timeout;

        xhr.setRequestHeader('Accept-Language', i18n.language);
        const clientHeaders = getClientHeaders();
        Object.entries(clientHeaders).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
        });

        if (accessToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        }

        xhr.onload = () => {
            resolve(parseApiResponseText(xhr.responseText, xhr.status));
        };

        xhr.onerror = () => {
            resolve({
                success: false,
                message: 'network_error',
                error: 'upload_network_error',
                status: xhr.status || 0,
            });
        };

        xhr.ontimeout = () => {
            resolve({
                success: false,
                message: 'network_error',
                error: 'upload_timeout',
                status: 0,
            });
        };

        xhr.send(body);
    });
};


export const api = {
    get: (endpoint: string) => apiRequest(endpoint, { method: 'GET' }),
    post: (endpoint: string, body: object) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    postFormData: (endpoint: string, body: FormData) => formDataRequest(endpoint, body),
    patch: (endpoint: string, body: object) => apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' }),
    setTokens: async (access: string, refresh: string) => {
        await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, access);
        await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refresh);
    },
    getTokens: async () => {
        const accessToken = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
        const refreshToken = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);
        return { accessToken, refreshToken };
    },
    clearTokens: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS);
        await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH);
    },
};
