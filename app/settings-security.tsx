import React, { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { KeyRound, LifeBuoy, Lock, Trash2, UserX } from 'lucide-react-native';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsNavRow, SettingsValueRow } from '@/components/settings/SettingsRows';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';

export default function SettingsSecurityScreen() {
    const colors = useColors();
    const primary = colors.chrome.primary;
    const user = useAuthStore((state) => state.user);
    const refreshUser = useAuthStore((state) => state.refreshUser);

    const googleConnected = Boolean(user?.googleId);
    const hasPassword = Boolean(user?.hasPassword);
    const showSetPassword = googleConnected && !hasPassword;

    useFocusEffect(
        useCallback(() => {
            refreshUser();
        }, [refreshUser])
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('security_privacy', 'Security & privacy')} fallbackHref="/(tabs)/settings" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(60) }}>
                {showSetPassword ? (
                    <SectionCard title={t('set_password', 'Set Login Password')}>
                        <SettingsNavRow
                            icon={<KeyRound size={scale(18)} color={primary} />}
                            label={t('you_signed_up_with_google', 'You signed up with Google. Set a password to also login with email.')}
                            description={t('click_to_set_password', 'Click here to set password')}
                            onPress={() => router.push('/set-password' as any)}
                        />
                    </SectionCard>
                ) : null}

                {hasPassword ? (
                    <SectionCard title={t('change_password', 'Change password')}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: scale(10), marginTop: scale(4) }}>
                            <View
                                style={{
                                    width: scale(38),
                                    height: scale(38),
                                    borderRadius: scale(19),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: colors.chrome.common.primaryTint,
                                }}
                            >
                                <Lock size={scale(18)} color={primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <SettingsValueRow
                                    label={t('change_password', 'Change password')}
                                    value={t('password_req', "To change your password, log out and select 'Forgot Password' on the login page.")}
                                />
                            </View>
                        </View>
                    </SectionCard>
                ) : null}

                <SectionCard>
                    <SettingsNavRow
                        icon={<UserX size={scale(18)} color={primary} />}
                        label={t('blocked_users', 'Blocked users')}
                        description={t('settings_blocked_users_desc', 'Review and unblock people you have blocked.')}
                        onPress={() => router.push({ pathname: '/(tabs)/activities', params: { tab: 'blocked' } })}
                    />
                    <SettingsNavRow
                        icon={<LifeBuoy size={scale(18)} color={primary} />}
                        label={t('report_issue', 'Report issue')}
                        description={t('settings_report_issue_desc', 'Tell us about a problem or send feedback.')}
                        onPress={() => router.push('/support')}
                    />
                </SectionCard>

                <SectionCard title={t('danger_zone', 'Danger zone')}>
                    <SettingsNavRow
                        icon={<Trash2 size={scale(18)} color={colors.brand.accent.error} />}
                        label={t('delete_your_account', 'Delete your account')}
                        description={t('settings_delete_account_desc', 'Permanently remove your account and data.')}
                        onPress={() => router.push('/delete-account' as any)}
                        danger
                    />
                </SectionCard>
            </ScrollView>
        </View>
    );
}
