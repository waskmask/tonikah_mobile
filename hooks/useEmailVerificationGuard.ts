import { useAuthStore } from '@/store/authStore';
import type { VerificationGuardAction } from '@/lib/emailVerificationGate';
import { useEmailVerificationGateStore } from '@/store/emailVerificationGateStore';

export type { VerificationGuardAction } from '@/lib/emailVerificationGate';

export function useEmailVerificationGuard() {
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);

    const requireVerified = (action: VerificationGuardAction = 'profileActions') => {
        if (emailVerified) return true;

        useEmailVerificationGateStore.getState().show(action);

        return false;
    };

    const refreshVerificationStatus = async () => {
        const res = await refreshUser();
        return Boolean(res.user?.email_verified ?? res.user?.emailVerified);
    };

    return {
        emailVerified,
        requireVerified,
        refreshVerificationStatus,
    };
}
