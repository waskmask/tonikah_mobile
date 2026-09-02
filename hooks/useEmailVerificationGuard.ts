import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/lib/profileDisplay';

export type VerificationGuardAction =
    | 'profileActions'
    | 'save'
    | 'chat'
    | 'report'
    | 'checkout'
    | 'browse';

const COPY: Record<VerificationGuardAction, { title: string; titleFallback: string; message: string; messageFallback: string }> = {
    profileActions: {
        title: 'verify_email_profile_actions_title',
        titleFallback: 'Verify your email to save profiles',
        message: 'verify_email_profile_actions_message',
        messageFallback: 'Please verify your email before saving or skipping profiles.',
    },
    save: {
        title: 'verify_email_profile_actions_title',
        titleFallback: 'Verify your email to save changes',
        message: 'verify_email_profile_actions_message',
        messageFallback: 'Please verify your email before saving changes.',
    },
    chat: {
        title: 'verify_email_full_chat_title',
        titleFallback: 'Verify your email to use full chat',
        message: 'verify_email_full_chat_message',
        messageFallback: 'Please verify your email before opening conversations or sending messages.',
    },
    report: {
        title: 'verify_email_report_title',
        titleFallback: 'Verify your email to report',
        message: 'verify_email_report_message',
        messageFallback: 'Please verify your email before submitting reports.',
    },
    checkout: {
        title: 'email_not_verified',
        titleFallback: 'Email Not Verified',
        message: 'verify_email_checkout_message',
        messageFallback: 'Please verify your email before starting checkout.',
    },
    browse: {
        title: 'verify_email_browse_limit_title',
        titleFallback: 'Verify your email to keep browsing',
        message: 'verify_email_browse_limit_message',
        messageFallback: 'Verify your email to continue exploring more matches.',
    },
};

export function useEmailVerificationGuard() {
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);

    const requireVerified = (action: VerificationGuardAction = 'profileActions') => {
        if (emailVerified) return true;

        const copy = COPY[action];
        Alert.alert(
            t(copy.title, copy.titleFallback),
            t(copy.message, copy.messageFallback),
            [
                { text: t('cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('verify_email', 'Verify Email-address Now'),
                    onPress: () => {
                        router.push({
                            pathname: '/(auth)/verify-email',
                            params: { email: user?.email || '' },
                        });
                    },
                },
            ]
        );

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
