import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, AuthResponse, GoogleAuthRequest, SignupRequest, User } from '@/lib/authService';
import { api } from '@/lib/api';
import { signInWithGoogle } from '@/lib/googleSignIn';
import { registerForPushNotifications, removeRegisteredPushToken } from '@/lib/pushNotifications';

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
        set({ isLoading: true });
        try {
            await removeRegisteredPushToken().catch(() => { });
            const { refreshToken } = await api.getTokens();
            if (refreshToken) {
                // Fire and forget logout call
                authService.logout({ refreshToken }).catch(() => { });
            }
        } finally {
            await api.clearTokens();
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },

    logoutAllDevices: async () => {
        set({ isLoading: true });
        try {
            await removeRegisteredPushToken().catch(() => { });
            const result = await authService.revokeAllSessions();
            if (result.success) {
                await api.clearTokens();
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

            // Fast path: cached user unblocks the splash without a network
            // round-trip; /me refreshes (or logs out) in the background.
            const cached = await AsyncStorage.getItem(USER_CACHE_KEY).catch(() => null);
            if (cached) {
                try {
                    const cachedUser = JSON.parse(cached) as User;
                    set({ user: cachedUser, isAuthenticated: true, isRestoringSession: false });
                    registerForPushNotifications().catch(() => { });
                    authService.me()
                        .then((result) => {
                            if (result.success && result.user) {
                                set({ user: result.user, isAuthenticated: true });
                            } else {
                                void api.clearTokens();
                                void AsyncStorage.removeItem(USER_CACHE_KEY);
                                set({ user: null, isAuthenticated: false });
                            }
                        })
                        .catch(() => {
                            // Network failure: keep the cached session, retry next launch
                        });
                    return;
                } catch {
                    // Corrupt cache — fall through to the blocking fetch
                }
            }

            const result = await authService.me();

            if (result.success && result.user) {
                set({ user: result.user, isAuthenticated: true });
                registerForPushNotifications().catch(() => { });
            } else {
                await api.clearTokens();
                set({ user: null, isAuthenticated: false });
            }
        } catch {
            await api.clearTokens();
            set({ user: null, isAuthenticated: false });
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
        void AsyncStorage.removeItem(USER_CACHE_KEY).catch(() => undefined);
    }
});
