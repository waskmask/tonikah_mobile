import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, LogOut, ShieldCheck, UserRound, FileLock2 } from 'lucide-react-native';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsNavRow } from '@/components/settings/SettingsRows';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';

export default function SettingsScreen() {
    const { user, logout, isLoading } = useAuthStore();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const emailNotVerifiedDesc = t(
        'email_not_verified_desc',
        'Please verify your email within {time} to keep your account active and receive important updates.',
        { time: '7 days' }
    ).replaceAll('{time}', '7 days').replaceAll('{{time}}', '7 days');

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('settings', 'Settings')} fallbackHref="/(tabs)/profile" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
                {!emailVerified ? (
                    <View style={{ marginBottom: scale(14) }}>
                        <EmailVerificationRequiredBanner
                            email={user?.email}
                            title={t('email_not_verified', 'Email not verified')}
                            message={emailNotVerifiedDesc}
                            actionLabel={t('verify_email', 'Verify Email-address Now')}
                        />
                    </View>
                ) : null}

                <SectionCard>
                    <SettingsNavRow
                        icon={<UserRound size={scale(18)} color={primary} />}
                        label={t('account', 'Account')}
                        description={t('settings_hub_account_desc', 'Email, language and active sessions.')}
                        onPress={() => router.push('/settings-account' as any)}
                    />
                    <SettingsNavRow
                        icon={<Bell size={scale(18)} color={primary} />}
                        label={t('settings_notifications_appearance', 'Notifications & appearance')}
                        description={t('settings_hub_notifications_desc', 'Message alerts and app theme.')}
                        onPress={() => router.push('/settings-notifications' as any)}
                    />
                    <SettingsNavRow
                        icon={<FileLock2 size={scale(18)} color={primary} />}
                        label={t('data_privacy', 'Data & privacy')}
                        description={t('settings_hub_privacy_desc', 'Marketing emails, consent and your data.')}
                        onPress={() => router.push('/settings-privacy' as any)}
                    />
                    <SettingsNavRow
                        icon={<ShieldCheck size={scale(18)} color={primary} />}
                        label={t('security_privacy', 'Security & privacy')}
                        description={t('settings_hub_security_desc', 'Blocked users, support and account removal.')}
                        onPress={() => router.push('/settings-security' as any)}
                    />
                </SectionCard>

                <SectionCard>
                    <SettingsNavRow
                        icon={<LogOut size={scale(18)} color={colors.brand.accent.error} />}
                        label={t('logout', 'Logout')}
                        description={t('settings_logout_desc', 'Sign out on this phone.')}
                        onPress={async () => {
                            await logout();
                            router.replace('/(auth)/login');
                        }}
                        disabled={isLoading}
                        danger
                    />
                </SectionCard>
            </ScrollView>
        </View>
    );
}
