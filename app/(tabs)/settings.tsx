import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { authService } from '@/lib/authService';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';

export default function SettingsScreen() {
    const { user, logout, logoutAllDevices, isLoading } = useAuthStore();
    const { isDark, toggleTheme } = useTheme();
    const [loggingOutAll, setLoggingOutAll] = useState(false);

    const resend = async () => {
        if (!user?.email) return;
        const res = await authService.resendVerification(user.email);
        Alert.alert(t('verify_email', 'Verify Email-address Now'), t(res.message || 'verification_email_sent', 'Verification email sent.'));
    };

    const confirmLogoutAllDevices = () => {
        Alert.alert(
            t('logout_all_devices', 'Logout all devices'),
            t('logout_all_devices_confirm', 'This will sign you out on every device, including this phone.'),
            [
                { text: t('cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('logout', 'Logout'),
                    style: 'destructive',
                    onPress: async () => {
                        setLoggingOutAll(true);
                        await logoutAllDevices();
                        setLoggingOutAll(false);
                        router.replace('/(auth)/login');
                    },
                },
            ]
        );
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Text variant="h2">{t('settings', 'Settings')}</Text>
            <Row label={t('email', 'Email')} value={user?.email || ''} isDark={isDark} />
            <Row label={t('language', 'Language')} custom={<LanguagePicker />} isDark={isDark} />
            <Action label={t('theme', 'Theme')} onPress={toggleTheme} isDark={isDark} />
            {!(user?.email_verified || user?.emailVerified) && <Action label={t('verify_email', 'Verify Email-address Now')} onPress={resend} isDark={isDark} />}
            <Action label={t('blocked_users', 'Blocked users')} onPress={() => router.push('/(tabs)/blocked-users')} isDark={isDark} />
            <Action label={t('report_issue', 'Report issue')} onPress={() => router.push('/support')} isDark={isDark} />
            <Action
                label={loggingOutAll ? t('please_wait', 'Please wait') : t('logout_all_devices', 'Logout all devices')}
                danger
                disabled={loggingOutAll || isLoading}
                onPress={confirmLogoutAllDevices}
                isDark={isDark}
            />
            <Action label={t('logout', 'Logout')} danger disabled={isLoading} onPress={async () => { await logout(); router.replace('/(auth)/login'); }} isDark={isDark} />
        </ScrollView>
    );
}

function Row({ label, value, custom, isDark }: any) {
    return (
        <View style={{ marginTop: scale(14), borderRadius: scale(14), padding: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
            <Text variant="caption" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>{label}</Text>
            {custom || <Text variant="body" style={{ marginTop: scale(4) }}>{value}</Text>}
        </View>
    );
}

function Action({ label, onPress, danger, isDark, disabled }: any) {
    return (
        <Pressable disabled={disabled} onPress={onPress} style={{ marginTop: scale(10), borderRadius: scale(14), padding: scale(14), opacity: disabled ? 0.55 : 1, backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
            <Text variant="body" style={{ color: danger ? '#E11D48' : undefined }}>{label}</Text>
        </Pressable>
    );
}
