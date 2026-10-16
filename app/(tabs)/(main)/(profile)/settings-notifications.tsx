import React from 'react';
import { ScrollView, View } from 'react-native';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { NotificationAppearanceSettings } from '@/components/settings/NotificationAppearanceSettings';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';

export default function SettingsNotificationsScreen() {
    const colors = useColors();

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('settings_notifications_appearance', 'Notifications & appearance')} fallbackHref="/settings" showMenu />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 0, paddingBottom: scale(60) }}>
                <NotificationAppearanceSettings />
            </ScrollView>
        </View>
    );
}
