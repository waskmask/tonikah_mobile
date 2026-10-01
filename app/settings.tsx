import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ShieldCheck, UserRound, FileLock2 } from '@/components/ui/icons/PhosphorCompat';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { HeardAboutUsSettingsPrompt } from '@/components/settings/HeardAboutUsSettingsPrompt';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SettingsNavRow } from '@/components/settings/SettingsRows';
import { SettingsFieldSection } from '@/components/settings/SettingsFieldSection';
import { NotificationAppearanceSettings } from '@/components/settings/NotificationAppearanceSettings';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import {
    fetchActiveSessions,
    fetchPrivacyConsent,
    SETTINGS_DATA_STALE_TIME_MS,
} from '@/lib/settingsQueries';

export default function SettingsScreen() {
    const { user, refreshUser, setUser } = useAuthStore();
    const colors = useColors();
    const iconColor = colors.chrome.common.textStrong;
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

    useEffect(() => {
        void queryClient.prefetchQuery({
            queryKey: queryKeys.settings.activeSessions,
            queryFn: fetchActiveSessions,
            staleTime: SETTINGS_DATA_STALE_TIME_MS,
        });
        void queryClient.prefetchQuery({
            queryKey: queryKeys.settings.privacyConsent,
            queryFn: fetchPrivacyConsent,
            staleTime: SETTINGS_DATA_STALE_TIME_MS,
        });
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('settings', 'Settings')} fallbackHref="/(tabs)/profile" showMenu />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: 0, paddingBottom: scale(120) }}
                showsVerticalScrollIndicator={false}
            >
                {!emailVerified && verificationBannerVisible ? (
                    <View style={[styles.promptWrap, styles.topPromptWrap]}>
                        <EmailVerificationRequiredBanner
                            email={user?.email}
                            onDismiss={() => setVerificationBannerVisible(false)}
                            title={t('email_not_verified', 'Email not verified')}
                            message={emailNotVerifiedDesc}
                        />
                    </View>
                ) : null}

                <SettingsFieldSection>
                    <SettingsNavRow
                        icon={<UserRound size={scale(19)} color={iconColor} />}
                        label={t('account', 'Account')}
                        description={t('settings_hub_account_desc', 'Email, language, personal info and sessions.')}
                        onPress={() => router.push('/settings-account' as any)}
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
                </SettingsFieldSection>

                <NotificationAppearanceSettings />

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

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    promptWrap: {
        marginBottom: scale(14),
        paddingHorizontal: scale(14),
    },
    topPromptWrap: {
        paddingTop: scale(14),
    },
});
