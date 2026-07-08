import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsToggleRow } from '@/components/settings/SettingsRows';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import {
    disablePushNotifications,
    enablePushNotifications,
    getPushNotificationStatus,
    openPushNotificationSettings,
} from '@/lib/pushNotifications';

export default function SettingsNotificationsScreen() {
    const { isDark, toggleTheme } = useTheme();
    const colors = useColors();
    const toast = useToast();
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationsBusy, setNotificationsBusy] = useState(false);

    const refreshNotificationStatus = useCallback(async () => {
        const status = await getPushNotificationStatus();
        setNotificationsEnabled(status.enabled);
    }, []);

    useEffect(() => {
        refreshNotificationStatus();
    }, [refreshNotificationStatus]);

    useFocusEffect(
        useCallback(() => {
            refreshNotificationStatus();
        }, [refreshNotificationStatus])
    );

    const toggleNotifications = async (nextValue: boolean) => {
        setNotificationsBusy(true);
        try {
            if (!nextValue) {
                await disablePushNotifications();
                setNotificationsEnabled(false);
                toast.show(t('chat:notifications_disabled', 'Notifications disabled.'), 'success', 2500);
                return;
            }

            const res = await enablePushNotifications();
            await refreshNotificationStatus();
            if (res.success) {
                toast.show(t('chat:notifications_enabled', 'Notifications enabled.'), 'success', 2500);
            } else if (res.message === 'push_permission_denied') {
                toast.show(t('chat:notifications_blocked', 'Notifications are blocked. Enable them in device settings.'), 'warning', 4000);
                await openPushNotificationSettings();
            } else {
                toast.show(t('chat:notifications_not_available', 'Notifications are not available yet.'), 'warning', 3500);
            }
        } finally {
            setNotificationsBusy(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('settings_notifications_appearance', 'Notifications & appearance')} fallbackHref="/(tabs)/settings" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(60) }}>
                <SectionCard title={t('notifications', 'Notifications')}>
                    <SettingsToggleRow
                        label={t('chat:notifications_setting_title', 'Message notifications')}
                        description={t('chat:notifications_setting_desc', 'Get alerts for new messages and requests.')}
                        value={notificationsEnabled}
                        disabled={notificationsBusy}
                        onValueChange={toggleNotifications}
                    />
                </SectionCard>
                <SectionCard title={t('appearance', 'Appearance')}>
                    <SettingsToggleRow
                        label={t('dark_mode', 'Dark mode')}
                        description={t('dark_mode_desc', 'Use a darker color scheme across the app.')}
                        value={isDark}
                        onValueChange={() => toggleTheme()}
                    />
                </SectionCard>
            </ScrollView>
        </View>
    );
}
