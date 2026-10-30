import { useSettingsBottomPadding } from '@/components/settings/useSettingsBottomPadding';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { NotificationAppearanceSettings } from '@/components/settings/NotificationAppearanceSettings';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';

export default function SettingsNotificationsScreen() {
    const colors = useColors();
    const bottomPadding = useSettingsBottomPadding();

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('settings_notifications_appearance', 'Notifications & appearance')} fallbackHref="/settings" showMenu />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 0, paddingBottom: bottomPadding }}>
                <NotificationAppearanceSettings />
            </ScrollView>
        </View>
    );
}
