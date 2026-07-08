import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { LifeBuoy, Trash2, UserX } from 'lucide-react-native';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsNavRow } from '@/components/settings/SettingsRows';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';

export default function SettingsSecurityScreen() {
    const colors = useColors();
    const primary = colors.chrome.primary;

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('security_privacy', 'Security & privacy')} fallbackHref="/(tabs)/settings" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(60) }}>
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
