import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuthStore } from '@/store/authStore';
import { scale } from '@/hooks/useResponsive';

function readableReason(reason?: string) {
    if (!reason) return '';
    return reason.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AccountSuspendedScreen() {
    const colors = useColors();
    const { t, currentLanguage } = useLanguage();
    const suspension = useAuthStore((state) => state.suspension);
    const expiry = suspension?.autoLiftAt
        ? new Intl.DateTimeFormat(currentLanguage, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(suspension.autoLiftAt))
        : null;

    const contactSupport = () => {
        const subject = encodeURIComponent(t('suspended_support_subject', 'Suspended account support'));
        void Linking.openURL(`mailto:support@tonikah.com?subject=${subject}`);
    };

    return (
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.brand.bg.primary }]}>
            <View style={styles.content}>
                <View style={[styles.iconWrap, { backgroundColor: colors.brand.bg.surface }]}>
                    <ShieldAlert size={scale(34)} color={colors.brand.gradient.start} strokeWidth={1.8} />
                </View>
                <Text variant="h2" style={styles.title}>{t('account_suspended_title', 'Account suspended')}</Text>
                <Text variant="body" style={[styles.description, { color: colors.brand.text.muted }]}>
                    {t('account_suspended_description', 'Your account has been suspended. You have been signed out of all devices.')}
                </Text>

                <View style={[styles.details, { borderColor: colors.brand.bg.border }]}>
                    {!!suspension?.reason && (
                        <View style={styles.detailRow}>
                            <Text variant="body-sm" style={styles.detailLabel}>{t('suspension_reason', 'Reason')}</Text>
                            <Text variant="body">{readableReason(suspension.reason)}</Text>
                        </View>
                    )}
                    <View style={styles.detailRow}>
                        <Text variant="body-sm" style={styles.detailLabel}>{t('suspension_duration', 'Duration')}</Text>
                        <Text variant="body">
                            {expiry
                                ? t('suspended_until', 'Until {{date}}', { date: expiry })
                                : t('suspended_indefinitely', 'No scheduled end date')}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.footer}>
                <GradientButton title={t('contact_support', 'Contact Support')} onPress={contactSupport} widthMode="full" />
                <PressableScale onPress={() => router.replace('/(auth)/login')} style={styles.backButton}>
                    <Text variant="button">{t('back_to_login', 'Back to login')}</Text>
                </PressableScale>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    content: { flex: 1, justifyContent: 'center', paddingHorizontal: scale(28) },
    iconWrap: { width: scale(68), height: scale(68), alignItems: 'center', justifyContent: 'center', borderRadius: scale(8), marginBottom: scale(24) },
    title: { marginBottom: scale(10) },
    description: { lineHeight: scale(24), marginBottom: scale(28) },
    details: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: scale(4) },
    detailRow: { gap: scale(6), paddingVertical: scale(16) },
    detailLabel: { fontWeight: '700' },
    footer: { paddingHorizontal: scale(20), paddingBottom: scale(12), gap: scale(8) },
    backButton: { minHeight: scale(48), alignItems: 'center', justifyContent: 'center' },
});
