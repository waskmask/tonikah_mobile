import { useEffect } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { queryClient } from '@/lib/queryClient';

import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';

type Props = {
    visible: boolean;
    email?: string | null;
    title: string;
    message: string;
    onDismiss: () => void;
};

export function EmailVerificationModal({ visible, email, title, message, onDismiss }: Props) {
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const userId = user?._id ?? user?.id;

    useEffect(() => {
        if (!visible || !userId || emailVerified) return;
        let inFlight = false;
        let stopped = false;
        const refresh = async () => {
            if (stopped || inFlight || AppState.currentState !== 'active') return;
            inFlight = true;
            try {
                const result = await refreshUser();
                if (result.success && (result.user?.email_verified ?? result.user?.emailVerified)) {
                    void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
                }
            } catch {
                // Keep the gate closed to protected actions until the server confirms verification.
            } finally {
                inFlight = false;
            }
        };
        void refresh();
        const timer = setInterval(() => { void refresh(); }, 5000);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void refresh();
        });
        return () => {
            stopped = true;
            clearInterval(timer);
            subscription.remove();
        };
    }, [visible, userId, emailVerified, refreshUser]);

    return (
        <Modal
            visible={visible && !emailVerified}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onDismiss}
        >
            <View style={styles.overlay}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('close', 'Close')}
                    onPress={onDismiss}
                    style={StyleSheet.absoluteFill}
                />
                {visible ? (
                    <View style={styles.content} accessibilityViewIsModal>
                        <EmailVerificationRequiredBanner
                            email={email}
                            title={title}
                            message={message}
                            floating
                            onDismiss={onDismiss}
                        />
                    </View>
                ) : null}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.58)',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: scale(18),
    },
    content: {
        maxWidth: scale(440),
        width: '100%',
    },
});
