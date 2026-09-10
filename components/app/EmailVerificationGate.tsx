import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { useAuthStore } from '@/store/authStore';
import { useEmailVerificationGateStore } from '@/store/emailVerificationGateStore';
import { VERIFICATION_GATE_COPY } from '@/lib/emailVerificationGate';
import { scale } from '@/hooks/useResponsive';
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
        <Modal
            visible={Boolean(copy)}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={hide}
        >
            <View style={styles.overlay}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('close', 'Close')}
                    onPress={hide}
                    style={StyleSheet.absoluteFill}
                />
                {copy ? (
                    <View style={styles.content}>
                        <EmailVerificationRequiredBanner
                            email={email}
                            title={t(copy.title, copy.titleFallback)}
                            message={t(copy.message, copy.messageFallback)}
                            floating
                            onDismiss={hide}
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
