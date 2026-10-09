import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ShieldAlert, X } from '@/components/ui/icons/PhosphorCompat';

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
    const resendInFlight = useRef(false);
    const retryUntil = useRef(0);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown(Math.max(0, Math.ceil((retryUntil.current - Date.now()) / 1000)));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const resend = async () => {
        if (resendInFlight.current || Date.now() < retryUntil.current) return;
        resendInFlight.current = true;
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
            const retryAfter = Number(res.retryAfter);
            const seconds = Number.isFinite(retryAfter) && retryAfter > 0
                ? Math.ceil(retryAfter)
                : res.success ? 60 : 0;
            retryUntil.current = Date.now() + seconds * 1000;
            setCooldown(seconds);
            if (res.success) {
                toast.show(t(res.message || 'verification_email_sent', 'Verification email sent.'), 'success', 3000);
            } else {
                toast.show(apiMessage(res.message || 'resend_failed', 'Resend failed'), 'error', 3500);
            }
        } catch {
            toast.show(apiMessage('resend_failed', 'Resend failed'), 'error', 3500);
        } finally {
            resendInFlight.current = false;
            setResending(false);
        }
    };

    const bg = isDark ? colors.chrome.common.cardAlt : colors.chrome.common.card;
    const border = colors.brand.bg.border;
    const text = colors.brand.text.heading;
    const muted = colors.brand.text.subtitle;
    const accent = colors.chrome.primary;
    const iconBackground = isDark ? 'rgba(243,75,111,0.16)' : 'rgba(243,75,111,0.10)';
    const resendDisabled = resending || cooldown > 0;

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
                            accessibilityState={{ disabled: resendDisabled, busy: resending }}
                            onPress={resend}
                            disabled={resendDisabled}
                            style={({ pressed }) => [
                                styles.textAction,
                                { direction: isRTL ? 'rtl' : 'ltr' },
                                (pressed || resendDisabled) && styles.buttonPressed,
                            ]}
                        >
                            {resending ? <ActivityIndicator size="small" color={text} /> : null}
                            <Text
                                className="font-body-bold"
                                style={[styles.buttonText, { color: text, textAlign: isRTL ? 'right' : 'left' }]}
                            >
                                {resending
                                    ? t('please_wait', 'Please wait...')
                                    : cooldown > 0
                                        ? t('resend_cooldown_in', 'Resend in {{seconds}}s', { seconds: cooldown })
                                        : t('resend_verification_link', 'Resend verification link')}
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                                onDismiss?.();
                                router.push('/change-email' as any);
                            }}
                            style={({ pressed }) => [
                                styles.textAction,
                                { direction: isRTL ? 'rtl' : 'ltr' },
                                pressed && styles.buttonPressed,
                            ]}
                        >
                            <Text
                                className="font-body-bold"
                                style={[styles.buttonText, { color: text, textAlign: isRTL ? 'right' : 'left' }]}
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
        gap: scale(12),
        marginTop: scale(16),
        paddingBottom: scale(8),
        width: '100%',
    },
    textAction: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: scale(5),
        minHeight: scale(44),
        justifyContent: 'flex-start',
        paddingHorizontal: 0,
        paddingVertical: scale(7),
    },
    buttonPressed: {
        opacity: 0.72,
    },
    buttonText: {
        fontSize: scale(12),
        flexShrink: 1,
        lineHeight: scale(16),
    },
});
