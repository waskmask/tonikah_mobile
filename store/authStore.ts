import { create } from 'zustand';
import { authService, AuthResponse, SignupRequest, User } from '@/lib/authService';
import { api } from '@/lib/api';
import { signInWithGoogle } from '@/lib/googleSignIn';
import { registerForPushNotifications, removeRegisteredPushToken } from '@/lib/pushNotifications';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isRestoringSession: boolean;

    login: (email: string, password: string) => Promise<AuthResponse>;
    signup: (data: SignupRequest) => Promise<AuthResponse>;
    googleAuth: () => Promise<AuthResponse>;
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

    googleAuth: async () => {
        set({ isLoading: true });
        try {
            const googleResult = await signInWithGoogle();

            if (googleResult.cancelled) {
                return { success: false, cancelled: true };
            }

            if (!googleResult.success || !googleResult.idToken) {
                return { success: false, message: googleResult.error || 'google_signin_failed' };
            }

            const result = await authService.googleAuth({ credential: googleResult.idToken });

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
                set({ isRestoringSession: false, isAuthenticated: false, user: null });
                return;
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
