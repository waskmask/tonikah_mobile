import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Monitor, Moon, Sun } from 'lucide-react-native';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsToggleRow } from '@/components/settings/SettingsRows';
import { Text } from '@/components/ui/Text';
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
    const { theme, setTheme } = useTheme();
    const colors = useColors();
    const toast = useToast();
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationsBusy, setNotificationsBusy] = useState(false);
    const [themeChanging, setThemeChanging] = useState<'light' | 'dark' | 'system' | null>(null);
    const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (themeTimer.current) clearTimeout(themeTimer.current);
    }, []);

    const changeTheme = (nextTheme: 'light' | 'dark' | 'system') => {
        if (themeChanging || theme === nextTheme) return;
        setThemeChanging(nextTheme);
        setTheme(nextTheme);
        themeTimer.current = setTimeout(() => {
            setThemeChanging(null);
            themeTimer.current = null;
        }, 300);
    };

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
                    <Text variant="body" className="font-body-semi" style={{ marginBottom: scale(10) }}>
                        {t('theme', 'Theme')}
                    </Text>
                    <View
                        style={{
                            flexDirection: 'row',
                            borderRadius: scale(12),
                            padding: scale(4),
                            backgroundColor: colors.brand.bg.surface,
                            borderWidth: 1,
                            borderColor: colors.brand.bg.border,
                            gap: scale(4),
                        }}
                    >
                        <ThemeSegment
                            active={theme === 'light'}
                            icon={Sun}
                            label={t('theme_light', 'Light')}
                            loading={themeChanging === 'light'}
                            disabled={themeChanging !== null}
                            onPress={() => changeTheme('light')}
                        />
                        <ThemeSegment
                            active={theme === 'dark'}
                            icon={Moon}
                            label={t('theme_dark', 'Dark')}
                            loading={themeChanging === 'dark'}
                            disabled={themeChanging !== null}
                            onPress={() => changeTheme('dark')}
                        />
                        <ThemeSegment
                            active={theme === 'system'}
                            icon={Monitor}
                            label={t('theme_system', 'System')}
                            loading={themeChanging === 'system'}
                            disabled={themeChanging !== null}
                            onPress={() => changeTheme('system')}
                        />
                    </View>
                </SectionCard>
            </ScrollView>
        </View>
    );
}

function ThemeSegment({
    active,
    icon: Icon,
    label,
    onPress,
    disabled,
    loading,
}: {
    active: boolean;
    icon: typeof Sun;
    label: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
}) {
    const colors = useColors();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled, busy: loading }}
            accessibilityLabel={label}
            style={{
                flex: 1,
                minHeight: scale(44),
                borderRadius: scale(10),
                alignItems: 'center',
                justifyContent: 'center',
                gap: scale(4),
                paddingVertical: scale(8),
                backgroundColor: active ? colors.chrome.common.card : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: active ? colors.brand.bg.border : 'transparent',
            }}
        >
            {loading ? (
                <ActivityIndicator size="small" color={colors.chrome.primary} />
            ) : (
                <Icon
                    size={scale(16)}
                    color={active ? colors.chrome.common.textStrong : colors.brand.text.muted}
                    strokeWidth={1.9}
                />
            )}
            <Text
                variant="caption"
                className="font-body-semi"
                style={{ color: active ? colors.chrome.common.textStrong : colors.brand.text.muted }}
            >
                {label}
            </Text>
        </Pressable>
    );
}
