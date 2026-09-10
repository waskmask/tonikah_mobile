import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, AuthResponse, GoogleAuthRequest, SignupRequest, User } from '@/lib/authService';
import { api } from '@/lib/api';
import { signInWithGoogle } from '@/lib/googleSignIn';
import { registerForPushNotifications, removeRegisteredPushToken } from '@/lib/pushNotifications';
import { queryClient } from '@/lib/queryClient';
import { canUseCachedUserAfterRefreshFailure, isAccessTokenUsable } from '@/lib/authToken';
import { clearPrivateChatData } from '@/lib/chatDataCleanup';

// Last known user, persisted so a returning user starts instantly and the
// fresh /me fetch happens in the background instead of blocking the splash.
const USER_CACHE_KEY = 'tonikah-user-cache';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isRestoringSession: boolean;

    login: (email: string, password: string) => Promise<AuthResponse>;
    signup: (data: SignupRequest) => Promise<AuthResponse>;
    googleAuth: (options?: Pick<GoogleAuthRequest, 'agreed' | 'marketing_opt_in' | 'lang'>) => Promise<AuthResponse>;
    logout: () => Promise<void>;
    logoutAllDevices: () => Promise<AuthResponse>;
    handleUnauthorized: () => Promise<void>;
    restoreSession: () => Promise<void>;
    refreshUser: () => Promise<AuthResponse>;
    setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isRestoringSession: true,

    setUser: (user: User) => set({ user, isAuthenticated: true }),

    login: async (email, password) => {
        set({ isLoading: true });
        try {
            const result = await authService.login({ email, password });

            if (result.success && result.accessToken && result.user) {
                await api.setTokens(result.accessToken, result.refreshToken || '');
                set({ user: result.user, isAuthenticated: true });
                registerForPushNotifications().catch(() => { });
            }
            return result;
        } finally {
            set({ isLoading: false });
        }
    },

    signup: async (data: SignupRequest) => {
        set({ isLoading: true });
        try {
            const result = await authService.signup(data);

            if (result.success && result.accessToken && result.user) {
                await api.setTokens(result.accessToken, result.refreshToken || '');
                set({ user: result.user, isAuthenticated: true });
                registerForPushNotifications().catch(() => { });
            }
            return result;
        } finally {
            set({ isLoading: false });
        }
    },

    googleAuth: async (options) => {
        set({ isLoading: true });
        try {
            const googleResult = await signInWithGoogle();

            if (googleResult.cancelled) {
                return { success: false, cancelled: true };
            }

            if (!googleResult.success || !googleResult.idToken) {
                return { success: false, message: googleResult.error || 'google_signin_failed' };
            }

            const payload: GoogleAuthRequest = {
                credential: googleResult.idToken,
                agreed: options?.agreed ?? true,
                marketing_opt_in: options?.marketing_opt_in ?? false,
                ...(options?.lang ? { lang: options.lang } : {}),
            };

            const result = await authService.googleAuth(payload);

            if (result.success && result.accessToken && result.user) {
                await api.setTokens(result.accessToken, result.refreshToken || '');
                set({ user: result.user, isAuthenticated: true });
                registerForPushNotifications().catch(() => { });
            }
            return result;
        } finally {
            set({ isLoading: false });
        }
    },

    logout: async () => {
        const userId = get().user?._id;
        set({ isLoading: true });
        try {
            await removeRegisteredPushToken().catch(() => { });
            const { refreshToken } = await api.getTokens();
            if (refreshToken) {
                // Fire and forget logout call
                authService.logout({ refreshToken }).catch(() => { });
            }
        } finally {
            await Promise.all([
                api.clearTokens(),
                clearPrivateChatData(userId),
            ]);
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    logoutAllDevices: async () => {
        const userId = get().user?._id;
        set({ isLoading: true });
        try {
            await removeRegisteredPushToken().catch(() => { });
            const result = await authService.revokeAllSessions();
            if (result.success) {
                await Promise.all([
                    api.clearTokens(),
                    clearPrivateChatData(userId),
                ]);
                set({ user: null, isAuthenticated: false, isLoading: false });
                return result;
            }
            set({ isLoading: false });
            return result;
        } catch {
            set({ isLoading: false });
            return { success: false, message: 'logout_failed' };
        }
    },

    handleUnauthorized: async () => {
        const userId = get().user?._id;
        await clearPrivateChatData(userId);
        set({ user: null, isAuthenticated: false, isLoading: false });
    },

    refreshUser: async () => {
        const result = await authService.me();
        if (result.success && result.user) {
            set({ user: result.user, isAuthenticated: true });
        }
        return result;
    },

    restoreSession: async () => {
        set({ isRestoringSession: true });
        try {
            const { accessToken } = await api.getTokens();

            if (!accessToken) {
                await AsyncStorage.removeItem(USER_CACHE_KEY).catch(() => undefined);
                set({ isRestoringSession: false, isAuthenticated: false, user: null });
                return;
            }

            const cached = await AsyncStorage.getItem(USER_CACHE_KEY).catch(() => null);
            let cachedUser: User | null = null;
            if (cached) {
                try {
                    cachedUser = JSON.parse(cached) as User;
                } catch {
                    await AsyncStorage.removeItem(USER_CACHE_KEY).catch(() => undefined);
                }
            }

            // Only a locally unexpired token may take the instant cached path.
            // The background /me remains authoritative and can still reject it.
            if (cachedUser && isAccessTokenUsable(accessToken)) {
                set({ user: cachedUser, isAuthenticated: true });
                registerForPushNotifications().catch(() => { });
                void authService.me().then((result) => {
                    if (result.success && result.user) {
                        set({ user: result.user, isAuthenticated: true });
                    }
                });
                return;
            }

            if (!isAccessTokenUsable(accessToken)) {
                const refreshResult = await api.refreshSession();
                if (!refreshResult.accessToken) {
                    if (cachedUser && canUseCachedUserAfterRefreshFailure(refreshResult.reason)) {
                        set({ user: cachedUser, isAuthenticated: true });
                    } else if (refreshResult.reason === 'unauthorized') {
                        set({ user: null, isAuthenticated: false });
                    }
                    return;
                }
            }

            const result = await authService.me();

            if (result.success && result.user) {
                set({ user: result.user, isAuthenticated: true });
                registerForPushNotifications().catch(() => { });
            } else if (result.message === 'network_error' && cachedUser) {
                set({ user: cachedUser, isAuthenticated: true });
            }
        } catch {
            // Keep credentials on transient startup failures. A later request
            // or foreground refresh can restore the session without a login.
        } finally {
            set({ isRestoringSession: false });
        }
    },
}));

// Persist the user on every change (login, refresh, background /me) and clear
// it on logout — single hook covers all code paths.
useAuthStore.subscribe((state, prevState) => {
    if (state.user === prevState.user) return;
    if (state.user) {
        void AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(state.user)).catch(() => undefined);
    } else {
        queryClient.clear();
        void AsyncStorage.removeItem(USER_CACHE_KEY).catch(() => undefined);
    }
});
