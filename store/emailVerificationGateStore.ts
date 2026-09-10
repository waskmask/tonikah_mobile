import { create } from 'zustand';

import type { VerificationGuardAction } from '@/lib/emailVerificationGate';

type EmailVerificationGateState = {
    action: VerificationGuardAction | null;
    show: (action: VerificationGuardAction) => void;
    hide: () => void;
};

export const useEmailVerificationGateStore = create<EmailVerificationGateState>((set) => ({
    action: null,
    show: (action) => set({ action }),
    hide: () => set({ action: null }),
}));
