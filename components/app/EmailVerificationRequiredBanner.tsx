import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ShieldAlert, X } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { authService } from '@/lib/authService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useAuthStore } from '@/store/authStore';

type Props = {
    email?: string | null;
    title: string;
    message: string;
    compact?: boolean;
    floating?: boolean;
    onDismiss?: () => void;
};

export function EmailVerificationRequiredBanner({
    email,
    title,
    message,
    compact = false,
    floating = false,
    onDismiss,
}: Props) {
    const colors = useColors();
    const { isDark } = useTheme();
    const { currentLanguage, isRTL } = useLanguage();
    const toast = useToast();
    const cachedEmail = useAuthStore((state) => state.user?.email);
    const refreshUser = useAuthStore((state) => state.refreshUser);
    const [resending, setResending] = useState(false);

    const resend = async () => {
        if (resending) return;
        setResending(true);
        try {
            let accountEmail = String(email || cachedEmail || '').trim();
            if (!accountEmail) {
                const refreshed = await refreshUser();
                accountEmail = String(refreshed.user?.email || '').trim();
            }

            if (!accountEmail) {
                toast.show(t('email_required', 'Email is required.'), 'error', 3500);
                return;
            }

            const res = await authService.resendVerification(accountEmail, currentLanguage);
            if (res.success) {
                toast.show(t(res.message || 'verification_email_sent', 'Verification email sent.'), 'success', 3000);
            } else {
                toast.show(apiMessage(res.message || 'resend_failed', 'Resend failed'), 'error', 3500);
            }
        } finally {
            setResending(false);
        }
    };

    const bg = isDark ? colors.chrome.common.cardAlt : colors.chrome.common.card;
    const border = colors.brand.bg.border;
    const text = colors.brand.text.heading;
    const muted = colors.brand.text.subtitle;
    const accent = colors.chrome.primary;
    const iconBackground = isDark ? 'rgba(243,75,111,0.16)' : 'rgba(243,75,111,0.10)';
    const darkButton = '#141210';
    const outline = isDark ? colors.brand.text.heading : darkButton;

    return (
        <View
            style={[
                styles.card,
                compact && styles.compactCard,
                floating && styles.floatingCard,
                { backgroundColor: bg, borderColor: border, shadowColor: colors.chrome.common.shadow },
            ]}
        >
            {onDismiss ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('close', 'Close')}
                    hitSlop={8}
                    onPress={onDismiss}
                    style={[
                        styles.closeButton,
                        isRTL ? styles.closeLeft : styles.closeRight,
                        { backgroundColor: colors.brand.bg.surface },
                    ]}
                >
                    <X size={scale(15)} color={colors.brand.text.subtitle} strokeWidth={2.4} />
                </Pressable>
            ) : null}
            <View style={[styles.content]}>
                <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
                    <ShieldAlert size={scale(17)} color={accent} strokeWidth={2.35} />
                </View>
                <View
                    style={[
                        styles.body,
                        onDismiss && (isRTL ? styles.bodyWithCloseRTL : styles.bodyWithClose),
                    ]}
                >
                    <Text style={[styles.title, { color: text, textAlign: isRTL ? 'right' : 'left' }]}>
                        {title}
                    </Text>
                    <Text style={[styles.message, { color: muted, textAlign: isRTL ? 'right' : 'left' }]}>
                        {message}
                    </Text>
                    <View style={[styles.actions]}>
                        <Pressable
                            accessibilityRole="button"
                            onPress={resend}
                            disabled={resending}
                            style={({ pressed }) => [
                                styles.button,
                                styles.filledButton,
                                { backgroundColor: darkButton },
                                (pressed || resending) && styles.buttonPressed,
                            ]}
                        >
                            {resending ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.78}
                                style={[styles.buttonText, { color: '#FFFFFF' }]}
                            >
                                {resending ? t('please_wait', 'Please wait...') : t('resend_email', 'Resend Email')}
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => router.push('/change-email' as any)}
                            style={({ pressed }) => [
                                styles.button,
                                styles.outlineButton,
                                { borderColor: outline },
                                pressed && styles.buttonPressed,
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.78}
                                style={[styles.buttonText, { color: outline }]}
                            >
                                {t('change_email_short', 'Change Email')}
                            </Text>
                        </Pressable>
                    </View>
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
        padding: scale(11),
    },
    floatingCard: {
        elevation: 10,
        shadowOffset: { width: 0, height: scale(5) },
        shadowOpacity: 0.16,
        shadowRadius: scale(12),
    },
    closeButton: {
        alignItems: 'center',
        borderRadius: scale(14),
        height: scale(28),
        justifyContent: 'center',
        position: 'absolute',
        top: scale(8),
        width: scale(28),
        zIndex: 2,
    },
    closeLeft: {
        left: scale(8),
    },
    closeRight: {
        right: scale(8),
    },
    content: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        gap: scale(10),
    },
    iconWrap: {
        alignItems: 'center',
        borderRadius: scale(15),
        height: scale(30),
        justifyContent: 'center',
        marginTop: scale(1),
        width: scale(30),
    },
    body: {
        flex: 1,
        minWidth: 0,
    },
    bodyWithClose: {
        paddingRight: scale(24),
    },
    bodyWithCloseRTL: {
        paddingLeft: scale(24),
    },
    title: {
        fontSize: scale(14),
        fontWeight: '700',
        lineHeight: scale(18),
    },
    message: {
        fontSize: scale(12),
        lineHeight: scale(17),
        marginTop: scale(2),
    },
    actions: {
        flexDirection: 'row',
        gap: scale(8),
        marginTop: scale(9),
        width: '100%',
    },
    button: {
        alignItems: 'center',
        borderRadius: scale(8),
        flex: 1,
        flexDirection: 'row',
        gap: scale(5),
        minHeight: scale(38),
        justifyContent: 'center',
        paddingHorizontal: scale(9),
        paddingVertical: scale(7),
    },
    filledButton: {
        borderWidth: 0,
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    buttonPressed: {
        opacity: 0.72,
    },
    buttonText: {
        fontSize: scale(12),
        fontWeight: '700',
        lineHeight: scale(16),
        textAlign: 'center',
    },
});
