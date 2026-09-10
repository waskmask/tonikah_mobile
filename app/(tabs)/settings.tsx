import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Bell, LogOut, ShieldCheck, UserRound, FileLock2 } from 'lucide-react-native';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { HeardAboutUsSettingsPrompt } from '@/components/settings/HeardAboutUsSettingsPrompt';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SettingsNavRow } from '@/components/settings/SettingsRows';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';

export default function SettingsScreen() {
    const { user, logout, isLoading, refreshUser, setUser } = useAuthStore();
    const colors = useColors();
    const iconColor = colors.chrome.common.iconNeutral;
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const [verificationBannerVisible, setVerificationBannerVisible] = useState(true);
    const [heardAboutUsAnswered, setHeardAboutUsAnswered] = useState(
        Boolean(user?.heard_about_us_answered),
    );
    const emailNotVerifiedDesc = t(
        'email_not_verified_desc',
        'Please verify your email within {time} to keep your account active and receive important updates.',
        { time: '7 days' }
    ).replaceAll('{time}', '7 days').replaceAll('{{time}}', '7 days');

    useFocusEffect(
        useCallback(() => {
            (async () => {
                const result = await refreshUser();
                if (result.success && result.user) {
                    setHeardAboutUsAnswered(Boolean(result.user.heard_about_us_answered));
                }
            })();
        }, [refreshUser])
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('settings', 'Settings')} fallbackHref="/(tabs)/profile" />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: scale(18), paddingBottom: scale(120) }}
                showsVerticalScrollIndicator={false}
            >
                {!emailVerified && verificationBannerVisible ? (
                    <View style={styles.promptWrap}>
                        <EmailVerificationRequiredBanner
                            email={user?.email}
                            onDismiss={() => setVerificationBannerVisible(false)}
                            title={t('email_not_verified', 'Email not verified')}
                            message={emailNotVerifiedDesc}
                        />
                    </View>
                ) : null}

                <View style={[styles.section, { borderColor: colors.brand.bg.border }]}>
                    <SettingsNavRow
                        icon={<UserRound size={scale(19)} color={iconColor} />}
                        label={t('account', 'Account')}
                        description={t('settings_hub_account_desc', 'Email, language, personal info and sessions.')}
                        onPress={() => router.push('/settings-account' as any)}
                    />
                    <SettingsNavRow
                        icon={<Bell size={scale(19)} color={iconColor} />}
                        label={t('settings_notifications_appearance', 'Notifications & appearance')}
                        description={t('settings_hub_notifications_desc', 'Message alerts and app theme.')}
                        onPress={() => router.push('/settings-notifications' as any)}
                        divider
                    />
                    <SettingsNavRow
                        icon={<FileLock2 size={scale(19)} color={iconColor} />}
                        label={t('data_privacy', 'Data & privacy')}
                        description={t('settings_hub_privacy_desc', 'Visibility, marketing emails, consent and your data.')}
                        onPress={() => router.push('/settings-privacy' as any)}
                        divider
                    />
                    <SettingsNavRow
                        icon={<ShieldCheck size={scale(19)} color={iconColor} />}
                        label={t('security_privacy', 'Security & privacy')}
                        description={t('settings_hub_security_desc', 'Password, blocked users, support and account removal.')}
                        onPress={() => router.push('/settings-security' as any)}
                        divider
                    />
                </View>

                {!heardAboutUsAnswered ? (
                    <View style={styles.promptWrap}>
                        <HeardAboutUsSettingsPrompt
                            onAnswered={() => {
                                setHeardAboutUsAnswered(true);
                                if (user) {
                                    setUser({ ...user, heard_about_us_answered: true });
                                }
                            }}
                        />
                    </View>
                ) : null}

                <View style={[styles.logoutSection, { borderColor: colors.brand.bg.border }]}>
                    <SettingsNavRow
                        icon={<LogOut size={scale(18)} color={colors.brand.accent.error} />}
                        label={isLoading ? t('please_wait', 'Please wait...') : t('logout', 'Logout')}
                        description={t('settings_logout_desc', 'Sign out on this phone.')}
                        onPress={async () => {
                            await logout();
                        }}
                        disabled={isLoading}
                        loading={isLoading}
                        danger
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    logoutSection: {
        borderTopWidth: StyleSheet.hairlineWidth,
        marginTop: scale(18),
    },
    promptWrap: {
        marginBottom: scale(14),
        paddingHorizontal: scale(14),
    },
});
