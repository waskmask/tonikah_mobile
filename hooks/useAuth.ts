import { create } from "zustand";

interface AuthState {
    user: any | null;
    isLoading: boolean;
    signIn: (data: any) => Promise<void>;
    signUp: (data: any) => Promise<void>;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: false,
    signIn: async () => { },
    signUp: async () => { },
    signOut: async () => set({ user: null }),
}));

export const useAuth = () => {
    const { user, isLoading, signIn, signUp, signOut } = useAuthStore();
    return { user, isLoading, signIn, signUp, signOut };
};
