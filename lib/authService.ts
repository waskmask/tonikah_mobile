import { api, ApiResponse } from './api';

export interface LoginRequest { email: string; password: string }
export interface SignupRequest { email: string; password: string; agreed: boolean; marketing_opt_in: boolean; lang?: string }
export interface GoogleAuthRequest { credential: string }
export interface RefreshRequest { refreshToken: string }

export interface User {
    _id: string;
    email: string;
    username: string;
    email_verified: boolean;
    profile?: Record<string, any>;
    hasPassword?: boolean;
    googleId?: string;
    [key: string]: any;
}

export interface AuthResponse extends ApiResponse {
    accessToken?: string;
    refreshToken?: string;
    user?: User;
    retryAfter?: number;
}

export interface UserSession {
    id: string;
    label: string;
    clientType?: string;
    clientPlatform?: string;
    ip?: string;
    createdAt?: string;
    lastUsedAt?: string;
    expiresAt?: string;
    current?: boolean;
}

export interface SessionsResponse extends ApiResponse {
    sessions?: UserSession[];
    revokedCount?: number;
}

export const authService = {
    login: (data: LoginRequest): Promise<AuthResponse> =>
        api.post('/app-user/mobile/login', data),

    signup: (data: SignupRequest): Promise<AuthResponse> =>
        api.post('/app-user/mobile/signup', data),

    googleAuth: (data: GoogleAuthRequest): Promise<AuthResponse> =>
        api.post('/app-user/mobile/auth/google', data),

    me: (): Promise<AuthResponse> =>
        api.get('/app-user/mobile/me'),

    refresh: (data: RefreshRequest): Promise<AuthResponse> =>
        api.post('/app-user/mobile/refresh', data),

    logout: (data: RefreshRequest): Promise<AuthResponse> =>
        api.post('/app-user/mobile/logout', data),

    revokeAllSessions: (): Promise<AuthResponse> =>
        api.post('/app-user/token/revoke-all', {}),

    listSessions: async (): Promise<SessionsResponse> => {
        const { refreshToken } = await api.getTokens();
        return api.post('/app-user/token/sessions', { refreshToken });
    },

    revokeOtherSessions: async (): Promise<SessionsResponse> => {
        const { refreshToken } = await api.getTokens();
        return api.post('/app-user/token/revoke-other-sessions', { refreshToken });
    },

    resendVerification: (email: string, lang?: string): Promise<AuthResponse> =>
        api.post('/app-user/resend-verification', { email, ...(lang ? { lang } : {}) }),

    requestPasswordReset: (email: string): Promise<AuthResponse> =>
        api.post('/app-user/password/request-reset', { email }),
};
