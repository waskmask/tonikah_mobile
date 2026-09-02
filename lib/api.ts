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

type RefreshResult = {
    accessToken: string | null;
    reason?: 'unauthorized' | 'network_error';
};

type UnauthorizedHandler = () => void | Promise<void>;

let isRefreshing = false;
let refreshSubscribers: ((result: RefreshResult) => void)[] = [];
let unauthorizedHandler: UnauthorizedHandler | null = null;
let unauthorizedPromise: Promise<void> | null = null;

const onRefreshed = (result: RefreshResult) => {
    refreshSubscribers.map(cb => cb(result));
    refreshSubscribers = [];
};

const addRefreshSubscriber = (cb: (result: RefreshResult) => void) => {
    refreshSubscribers.push(cb);
};

const clearStoredTokens = async () => {
    await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS),
        SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH),
    ]);
};

const notifyUnauthorized = async () => {
    if (!unauthorizedHandler) return;
    if (!unauthorizedPromise) {
        unauthorizedPromise = Promise.resolve()
            .then(() => unauthorizedHandler?.())
            .then(() => undefined)
            .finally(() => {
                unauthorizedPromise = null;
            });
    }
    await unauthorizedPromise;
};

const handleTerminalUnauthorized = async (): Promise<RefreshResult> => {
    await clearStoredTokens();
    await notifyUnauthorized();
    return { accessToken: null, reason: 'unauthorized' };
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

const refreshAccessTokenResult = async (): Promise<RefreshResult> => {
    const refreshToken = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);

    if (!refreshToken) {
        return handleTerminalUnauthorized();
    }

    if (isRefreshing) {
        return new Promise((resolve) => {
            addRefreshSubscriber(resolve);
        });
    }

    isRefreshing = true;
    let result: RefreshResult = { accessToken: null, reason: 'network_error' };

    try {
        const refreshRes = await fetch(`${Config.API_URL}/app-user/mobile/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getClientHeaders(),
            },
            body: JSON.stringify({ refreshToken }),
        });

        const refreshData = await refreshRes.json().catch(() => ({}));

        if (refreshRes.ok && refreshData.success && refreshData.accessToken) {
            await api.setTokens(refreshData.accessToken, refreshData.refreshToken || refreshToken);
            result = { accessToken: refreshData.accessToken };
        } else if (refreshRes.status === 401 || refreshRes.status === 403) {
            result = await handleTerminalUnauthorized();
        }
    } catch {
        // Keep credentials on transient network/provider failures. A later request can retry.
        result = { accessToken: null, reason: 'network_error' };
    } finally {
        isRefreshing = false;
        onRefreshed(result);
    }

    return result;
};

const refreshAccessToken = async (): Promise<string | null> => {
    const result = await refreshAccessTokenResult();
    return result.accessToken;
};

const handleResponse = async (response: Response, endpoint: string, options: FetchOptions): Promise<ApiResponse> => {
    // If 401 Unauthorized, handle token refresh logic
    if (response.status === 401 && endpoint !== '/app-user/mobile/refresh' && endpoint !== '/app-user/mobile/login') {
        const refreshResult = await refreshAccessTokenResult();
        if (refreshResult.accessToken) {
            // Re-attempt original request. `performFetch` reads the fresh token from secure store.
            return apiRequest(endpoint, options);
        }
        if (refreshResult.reason === 'network_error') {
            return { success: false, message: 'network_error', status: 0 };
        }
        return { success: false, message: 'unauthorized', status: 401 };
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

        xhr.onload = async () => {
            if (xhr.status === 401 && endpoint !== '/app-user/mobile/refresh' && endpoint !== '/app-user/mobile/login') {
                const refreshResult = await refreshAccessTokenResult();
                if (refreshResult.accessToken) {
                    resolve(formDataRequest(endpoint, body, timeout));
                    return;
                }
                if (refreshResult.reason === 'network_error') {
                    resolve({ success: false, message: 'network_error', status: 0 });
                    return;
                }
                resolve({ success: false, message: 'unauthorized', status: 401 });
                return;
            }

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
    deleteWithBody: (endpoint: string, body: object) => apiRequest(endpoint, { method: 'DELETE', body: JSON.stringify(body) }),
    setTokens: async (access: string, refresh: string) => {
        await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, access);
        await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refresh);
    },
    getTokens: async () => {
        const accessToken = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
        const refreshToken = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);
        return { accessToken, refreshToken };
    },
    refreshAccessToken,
    handleUnauthorized: async () => {
        await handleTerminalUnauthorized();
    },
    setUnauthorizedHandler: (handler: UnauthorizedHandler | null) => {
        unauthorizedHandler = handler;
        return () => {
            if (unauthorizedHandler === handler) unauthorizedHandler = null;
        };
    },
    clearTokens: async () => {
        await clearStoredTokens();
    },
};
