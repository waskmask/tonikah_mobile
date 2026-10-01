import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useQuery } from '@tanstack/react-query';

import { Bell, Monitor, Moon, Sun } from '@/components/ui/icons/PhosphorCompat';
import { SettingsToggleRow } from '@/components/settings/SettingsRows';
import { SettingsFieldSection } from '@/components/settings/SettingsFieldSection';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { t } from '@/lib/profileDisplay';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import {
    disablePushNotifications,
    enablePushNotifications,
    getPushNotificationStatus,
    openPushNotificationSettings,
} from '@/lib/pushNotifications';

async function fetchNotificationEnabled() {
    const status = await getPushNotificationStatus();
    return status.enabled;
}

export function NotificationAppearanceSettings() {
    const { theme, setTheme } = useTheme();
    const colors = useColors();
    const toast = useToast();
    const { lightImpact } = useHaptics();
    const [notificationsBusy, setNotificationsBusy] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState(theme);
    const [pendingTheme, setPendingTheme] = useState<'light' | 'dark' | 'system' | null>(null);
    const themeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nativeGlassModule = Platform.OS === 'ios'
        ? requireOptionalNativeModule('ExpoGlassEffect')
        : null;
    const hasNativeGlass = Platform.OS === 'ios'
        && !!nativeGlassModule
        && isGlassEffectAPIAvailable()
        && isLiquidGlassAvailable();
    const notificationQuery = useQuery({
        queryKey: queryKeys.settings.notificationStatus,
        queryFn: fetchNotificationEnabled,
        staleTime: 10_000,
    });
    const notificationsEnabled = notificationQuery.data || false;

    useEffect(() => {
        setSelectedTheme(theme);
        setPendingTheme((pending) => pending === theme ? null : pending);
    }, [theme]);

    useEffect(() => () => {
        if (themeTimerRef.current) clearTimeout(themeTimerRef.current);
    }, []);

    const changeTheme = (nextTheme: 'light' | 'dark' | 'system') => {
        if (selectedTheme === nextTheme) return;
        lightImpact();
        setSelectedTheme(nextTheme);
        setPendingTheme(nextTheme);
        if (themeTimerRef.current) clearTimeout(themeTimerRef.current);
        themeTimerRef.current = setTimeout(() => {
            setTheme(nextTheme);
            setPendingTheme(null);
            themeTimerRef.current = null;
        }, 80);
    };

    const toggleNotifications = async (nextValue: boolean) => {
        const previousValue = notificationsEnabled;
        queryClient.setQueryData(queryKeys.settings.notificationStatus, nextValue);
        setNotificationsBusy(true);
        try {
            if (!nextValue) {
                await disablePushNotifications();
                toast.show(t('chat:notifications_disabled', 'Notifications disabled.'), 'success', 2500);
                return;
            }

            const result = await enablePushNotifications();
            const status = await getPushNotificationStatus();
            queryClient.setQueryData(queryKeys.settings.notificationStatus, status.enabled);
            if (result.success) {
                toast.show(t('chat:notifications_enabled', 'Notifications enabled.'), 'success', 2500);
            } else if (result.message === 'push_permission_denied') {
                toast.show(t('chat:notifications_blocked', 'Notifications are blocked. Enable them in device settings.'), 'warning', 4000);
                await openPushNotificationSettings();
            } else {
                toast.show(t('chat:notifications_not_available', 'Notifications are not available yet.'), 'warning', 3500);
            }
        } catch {
            queryClient.setQueryData(queryKeys.settings.notificationStatus, previousValue);
            toast.show(t('chat:notifications_not_available', 'Notifications are not available yet.'), 'warning', 3500);
        } finally {
            setNotificationsBusy(false);
        }
    };

    return (
        <>
            <SettingsFieldSection title={t('notifications', 'Notifications')}>
                <SettingsToggleRow
                    icon={<Bell size={scale(19)} color={colors.chrome.common.textStrong} />}
                    label={t('chat:notifications_setting_title', 'Message notifications')}
                    description={t('chat:notifications_setting_desc', 'Get alerts for new messages and requests.')}
                    value={notificationsEnabled}
                    disabled={notificationsBusy}
                    onValueChange={toggleNotifications}
                />
            </SettingsFieldSection>

            <SettingsFieldSection title={t('appearance', 'Appearance')} contentInset>
                <Text variant="body-sm" style={styles.themeLabel}>
                    {t('theme', 'Theme')}
                </Text>
                <View
                    style={[
                        styles.themeControl,
                        {
                            backgroundColor: colors.brand.bg.surface,
                            borderColor: colors.brand.bg.border,
                        },
                    ]}
                >
                    <ThemeSegment
                        active={selectedTheme === 'light'}
                        icon={Sun}
                        label={t('theme_light', 'Light')}
                        nativeGlass={hasNativeGlass}
                        loading={pendingTheme === 'light'}
                        onPress={() => changeTheme('light')}
                    />
                    <ThemeSegment
                        active={selectedTheme === 'dark'}
                        icon={Moon}
                        label={t('theme_dark', 'Dark')}
                        nativeGlass={hasNativeGlass}
                        loading={pendingTheme === 'dark'}
                        onPress={() => changeTheme('dark')}
                    />
                    <ThemeSegment
                        active={selectedTheme === 'system'}
                        icon={Monitor}
                        label={t('theme_system', 'System')}
                        nativeGlass={hasNativeGlass}
                        loading={pendingTheme === 'system'}
                        onPress={() => changeTheme('system')}
                    />
                </View>
            </SettingsFieldSection>
        </>
    );
}

function ThemeSegment({
    active,
    icon: Icon,
    label,
    onPress,
    nativeGlass,
    loading,
}: {
    active: boolean;
    icon: typeof Sun;
    label: string;
    onPress: () => void;
    nativeGlass: boolean;
    loading: boolean;
}) {
    const colors = useColors();
    const { isDark } = useTheme();

    return (
        <View style={styles.themeSegmentSlot}>
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={{ selected: active, busy: loading }}
                accessibilityLabel={label}
                style={({ pressed }) => [
                    styles.themeSegment,
                    {
                        backgroundColor: active && !nativeGlass
                            ? isDark
                                ? colors.chrome.common.subtleSurface
                                : colors.chrome.common.card
                            : 'transparent',
                        borderColor: active && !nativeGlass ? colors.brand.bg.border : 'transparent',
                    },
                    pressed && styles.themeSegmentPressed,
                ]}
            >
                {active && nativeGlass ? (
                    <GlassView
                        pointerEvents="none"
                        isInteractive
                        glassEffectStyle="regular"
                        colorScheme={isDark ? 'dark' : 'light'}
                        style={styles.themeSegmentGlass}
                    />
                ) : null}
                <View pointerEvents="none" style={styles.themeSegmentContent}>
                    <View style={styles.themeSegmentIcon}>
                        {loading ? (
                            <ActivityIndicator
                                size="small"
                                color={active ? colors.chrome.common.textStrong : colors.chrome.primary}
                            />
                        ) : (
                            <Icon
                                size={scale(16)}
                                color={active ? colors.chrome.common.textStrong : colors.brand.text.muted}
                                strokeWidth={1.9}
                            />
                        )}
                    </View>
                    <Text
                        variant="caption"
                        numberOfLines={1}
                        style={{
                            color: active ? colors.chrome.common.textStrong : colors.brand.text.muted,
                            fontSize: scale(13),
                            lineHeight: scale(17),
                        }}
                    >
                        {label}
                    </Text>
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    themeLabel: {
        marginBottom: scale(10),
    },
    themeControl: {
        flexDirection: 'row',
        alignItems: 'stretch',
        borderRadius: scale(12),
        padding: scale(4),
        borderWidth: 1,
        gap: scale(4),
    },
    themeSegmentSlot: {
        flexBasis: 0,
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    themeSegment: {
        width: '100%',
        minHeight: scale(48),
        borderRadius: scale(10),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(8),
        paddingVertical: scale(8),
        overflow: 'hidden',
        borderCurve: 'continuous',
    },
    themeSegmentPressed: {
        transform: [{ scale: 0.985 }],
    },
    themeSegmentGlass: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: scale(10),
        borderCurve: 'continuous',
    },
    themeSegmentContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(6),
    },
    themeSegmentIcon: {
        width: scale(18),
        height: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
});
