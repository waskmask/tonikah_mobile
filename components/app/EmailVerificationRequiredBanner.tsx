import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Mail, ShieldAlert } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { authService } from '@/lib/authService';
import { apiMessage, t } from '@/lib/profileDisplay';

type Props = {
    email?: string | null;
    title: string;
    message: string;
    actionLabel?: string;
    compact?: boolean;
};

export function EmailVerificationRequiredBanner({
    email,
    title,
    message,
    actionLabel,
    compact = false,
}: Props) {
    const { isDark } = useTheme();
    const { currentLanguage, isRTL } = useLanguage();
    const toast = useToast();
    const [resending, setResending] = useState(false);

    const resend = async () => {
        if (!email || resending) return;
        setResending(true);
        const res = await authService.resendVerification(email, currentLanguage);
        if (res.success) {
            toast.show(t(res.message || 'verification_email_sent', 'Verification email sent.'), 'success', 3000);
        } else {
            toast.show(apiMessage(res.message || 'resend_failed', 'Resend failed'), 'error', 3500);
        }
        setResending(false);
    };

    const bg = isDark ? '#3F1725' : '#FFF1F2';
    const border = isDark ? '#7F1D3A' : '#FECDD3';
    const text = isDark ? '#FFE4E6' : '#9F1239';
    const muted = isDark ? '#FECACA' : 'rgba(159,18,57,0.78)';

    return (
        <View
            style={[
                styles.card,
                compact && styles.compactCard,
                { backgroundColor: bg, borderColor: border },
            ]}
        >
            <View style={[styles.content, isRTL && styles.rowReverse]}>
                <ShieldAlert size={scale(21)} color="#F34B6F" fill="#F34B6F" style={styles.icon} />
                <View style={styles.body}>
                    <Text style={[styles.title, { color: text, textAlign: isRTL ? 'right' : 'left' }]}>
                        {title}
                    </Text>
                    <Text style={[styles.message, { color: muted, textAlign: isRTL ? 'right' : 'left' }]}>
                        {message}
                    </Text>
                    {email ? (
                        <Pressable
                            onPress={resend}
                            disabled={resending}
                            style={({ pressed }) => [
                                styles.button,
                                isRTL && styles.rowReverse,
                                (pressed || resending) && styles.buttonPressed,
                            ]}
                        >
                            <Mail size={scale(15)} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.buttonText}>
                                {resending
                                    ? t('please_wait', 'Please wait...')
                                    : actionLabel || t('resend_verification_email', 'Resend verification email')}
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: scale(10),
        borderWidth: 1,
        padding: scale(14),
    },
    compactCard: {
        padding: scale(12),
    },
    content: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: scale(10),
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    icon: {
        marginTop: scale(2),
    },
    body: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: scale(15),
        fontWeight: '700',
        lineHeight: scale(20),
    },
    message: {
        fontSize: scale(13),
        lineHeight: scale(20),
        marginTop: scale(4),
    },
    button: {
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#F34B6F',
        borderRadius: scale(999),
        flexDirection: 'row',
        gap: scale(7),
        height: scale(36),
        justifyContent: 'center',
        marginTop: scale(12),
        paddingHorizontal: scale(14),
    },
    buttonPressed: {
        opacity: 0.72,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: scale(12),
        fontWeight: '700',
        lineHeight: scale(16),
    },
});
