import { useEffect } from 'react';

import { EmailVerificationModal } from '@/components/app/EmailVerificationModal';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGateStore } from '@/store/emailVerificationGateStore';
import { VERIFICATION_GATE_COPY } from '@/lib/emailVerificationGate';
import { t } from '@/lib/profileDisplay';

export function EmailVerificationGate() {
    const action = useEmailVerificationGateStore((state) => state.action);
    const hide = useEmailVerificationGateStore((state) => state.hide);
    const user = useAuthStore((state) => state.user);
    const email = user?.email;
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const copy = action ? VERIFICATION_GATE_COPY[action] : null;

    useEffect(() => {
        if (action && (!user || emailVerified)) hide();
    }, [action, emailVerified, hide, user]);

    return (
        <EmailVerificationModal
            visible={Boolean(copy)}
            email={email}
            title={copy ? t(copy.title, copy.titleFallback) : ''}
            message={copy ? t(copy.message, copy.messageFallback) : ''}
            onDismiss={hide}
        />
    );
}
