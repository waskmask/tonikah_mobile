import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LogOut, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import i18n from '@/lib/i18n';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { authService, UserSession } from '@/lib/authService';
import {
    disablePushNotifications,
    enablePushNotifications,
    getPushNotificationStatus,
    openPushNotificationSettings,
} from '@/lib/pushNotifications';

export default function SettingsScreen() {
    const { user, logout, logoutAllDevices, isLoading } = useAuthStore();
    const { isDark, toggleTheme } = useTheme();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const toast = useToast();
    const [loggingOutOthers, setLoggingOutOthers] = useState(false);
    const [loggingOutAll, setLoggingOutAll] = useState(false);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationsBusy, setNotificationsBusy] = useState(false);
    const emailVerified = Boolean(user?.email_verified ?? user?.emailVerified);
    const emailNotVerifiedDesc = t(
        'email_not_verified_desc',
        'Please verify your email within {time} to keep your account active and receive important updates.',
        { time: '7 days' }
    ).replaceAll('{time}', '7 days').replaceAll('{{time}}', '7 days');

    const refreshNotificationStatus = useCallback(async () => {
        const status = await getPushNotificationStatus();
        setNotificationsEnabled(status.enabled);
    }, []);

    const refreshSessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            const result = await authService.listSessions();
            if (result.success) {
                setSessions(result.sessions || []);
            }
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshNotificationStatus();
        refreshSessions();
    }, [refreshNotificationStatus, refreshSessions]);

    useFocusEffect(
        useCallback(() => {
            refreshNotificationStatus();
            refreshSessions();
        }, [refreshNotificationStatus, refreshSessions])
    );

    const confirmLogoutOtherDevices = () => {
        Alert.alert(
            t('logout_other_devices', 'Log out other devices'),
            t('logout_other_devices_confirm', 'This will sign you out on all other devices. This phone will stay logged in.'),
            [
                { text: t('cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('logout', 'Logout'),
                    style: 'destructive',
                    onPress: async () => {
                        setLoggingOutOthers(true);
                        const result = await authService.revokeOtherSessions();
                        setLoggingOutOthers(false);
                        if (result.success) {
                            toast.show(t('other_sessions_revoked', 'Other devices have been logged out.'), 'success', 3000);
                            await refreshSessions();
                        } else {
                            toast.show(t('sessions_revoke_failed', 'Could not log out other devices. Please try again.'), 'error', 3500);
                        }
                    },
                },
            ]
        );
    };

    const confirmLogoutAllDevices = () => {
        Alert.alert(
            t('logout_all_devices', 'Log out all devices'),
            t('logout_all_devices_confirm', 'This will sign you out on every device, including this phone.'),
            [
                { text: t('cancel', 'Cancel'), style: 'cancel' },
                {
                    text: t('logout', 'Logout'),
                    style: 'destructive',
                    onPress: async () => {
                        setLoggingOutAll(true);
                        const result = await logoutAllDevices();
                        setLoggingOutAll(false);
                        if (result.success) {
                            toast.show(t('all_sessions_revoked', 'You have been logged out on all devices.'), 'success', 3000);
                            router.replace('/(auth)/login');
                            return;
                        }
                        toast.show(t('all_sessions_revoke_failed', 'Could not log out all devices. Please try again.'), 'error', 3500);
                    },
                },
            ]
        );
    };

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
            <SectionCard title={t('account', 'Account')}>
                <Row label={t('email', 'Email')} value={user?.email || ''} isDark={isDark} embedded />
                <Row label={t('language', 'Language')} custom={<LanguagePicker />} isDark={isDark} embedded />
            </SectionCard>
            <SectionCard title={t('preferences', 'Preferences')}>
            <NotificationRow
                label={t('chat:notifications_setting_title', 'Message notifications')}
                description={t('chat:notifications_setting_desc', 'Get alerts for new messages and requests.')}
                value={notificationsEnabled}
                disabled={notificationsBusy}
                onValueChange={toggleNotifications}
                isDark={isDark}
            />
            <Action label={t('theme', 'Theme')} onPress={toggleTheme} isDark={isDark} embedded />
            </SectionCard>
            <SessionsSection
                sessions={sessions}
                loading={sessionsLoading}
                revokeOthersBusy={loggingOutOthers}
                revokeAllBusy={loggingOutAll || isLoading}
                onRefresh={refreshSessions}
                onRevokeOthers={confirmLogoutOtherDevices}
                onRevokeAll={confirmLogoutAllDevices}
                isDark={isDark}
                primary={primary}
            />
            <SectionCard title={t('security_privacy', 'Security & privacy')}>
            <Action label={t('blocked_users', 'Blocked users')} onPress={() => router.push({ pathname: '/(tabs)/activities', params: { tab: 'blocked' } })} isDark={isDark} embedded />
            <Action label={t('report_issue', 'Report issue')} onPress={() => router.push('/support')} isDark={isDark} embedded />
            <Action label={t('logout', 'Logout')} danger disabled={isLoading} onPress={async () => { await logout(); router.replace('/(auth)/login'); }} isDark={isDark} embedded />
            </SectionCard>
            </ScrollView>
        </View>
    );
}

function SessionsSection({ sessions, loading, revokeOthersBusy, revokeAllBusy, onRefresh, onRevokeOthers, onRevokeAll, isDark, primary }: any) {
    const colors = useColors();
    const otherSessions = sessions.filter((session: UserSession) => !session.current);
    const borderColor = colors.brand.bg.border;
    const muted = colors.brand.text.subtitle;
    const activeCount = sessions.length;

    return (
        <SectionCard title={t('active_sessions', 'Active sessions')} style={{ marginTop: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
                <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chrome.common.primaryTint }}>
                    <Smartphone size={scale(19)} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text variant="caption" style={{ color: muted }}>
                        {activeCount ? t('active_sessions_count', '{{count}} active session(s)', { count: activeCount }).replace('{{count}}', String(activeCount)) : t('active_sessions_desc', 'Manage where your account is currently logged in.')}
                    </Text>
                </View>
                <Pressable
                    onPress={onRefresh}
                    disabled={loading}
                    hitSlop={10}
                    style={{
                        width: scale(36),
                        height: scale(36),
                        borderRadius: scale(18),
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: loading ? 0.5 : 1,
                        backgroundColor: colors.brand.bg.surface,
                    }}
                >
                    {loading ? <ActivityIndicator color={primary} size="small" /> : <RefreshCw size={scale(16)} color={primary} />}
                </Pressable>
            </View>

            {loading ? (
                null
            ) : (
                <View style={{ marginTop: scale(10), borderTopWidth: 1, borderTopColor: borderColor }}>
                    {sessions.length ? sessions.map((session: UserSession) => (
                        <SessionRow key={session.id} session={session} isDark={isDark} />
                    )) : (
                        <Text variant="body-sm" style={{ marginTop: scale(12), color: colors.brand.text.subtitle }}>
                            {t('no_active_sessions', 'No active sessions found.')}
                        </Text>
                    )}
                </View>
            )}

            <View style={{ gap: scale(10), marginTop: scale(12) }}>
                <SessionSecurityButton
                    label={revokeOthersBusy ? t('please_wait', 'Please wait') : t('logout_other_devices', 'Log out other devices')}
                    description={t('logout_other_devices_hint', 'Keep this phone signed in and remove every other session.')}
                    icon={<LogOut size={scale(17)} color={primary} />}
                    disabled={revokeOthersBusy || revokeAllBusy || otherSessions.length === 0}
                    onPress={onRevokeOthers}
                    isDark={isDark}
                />
                <SessionSecurityButton
                    label={revokeAllBusy ? t('please_wait', 'Please wait') : t('logout_all_devices', 'Log out all devices')}
                    description={t('logout_all_devices_hint', 'End every session and return to login on this phone.')}
                    icon={<ShieldAlert size={scale(17)} color="#E11D48" />}
                    disabled={revokeAllBusy || revokeOthersBusy}
                    onPress={onRevokeAll}
                    isDark={isDark}
                    danger
                />
            </View>
        </SectionCard>
    );
}

function SessionSecurityButton({ label, description, icon, disabled, onPress, isDark, danger }: any) {
    const colors = useColors();
    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            style={{
                borderRadius: scale(14),
                borderWidth: 1,
                borderColor: danger ? colors.chrome.common.dangerRing : colors.brand.bg.border,
                padding: scale(12),
                opacity: disabled ? 0.55 : 1,
                backgroundColor: danger ? colors.chrome.common.dangerTint : colors.chrome.common.card,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
                <View style={{ width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? colors.chrome.common.dangerTint : colors.chrome.common.primaryTint }}>
                    {icon}
                </View>
                <View style={{ flex: 1 }}>
                    <Text variant="body-sm" className="font-body-semi" style={{ color: danger ? colors.brand.accent.error : colors.chrome.common.textStrong }}>
                        {label}
                    </Text>
                    <Text variant="caption" style={{ marginTop: scale(3), color: colors.brand.text.subtitle }}>
                        {description}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

function SessionRow({ session, isDark }: { session: UserSession; isDark: boolean }) {
    const colors = useColors();
    const lastUsed = formatSessionDate(session.lastUsedAt || session.createdAt);
    const locationLabel = formatSessionLocation(session);
    const platformLabel = session.current
        ? t('current_device', 'Current device')
        : t('other_device', 'Other device');

    return (
        <View style={{ paddingVertical: scale(12), borderBottomWidth: 1, borderBottomColor: colors.brand.bg.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: scale(12) }}>
                <View style={{ flex: 1 }}>
                    <Text variant="body-sm" className="font-body-semi">{session.label || t('unknown_device', 'Unknown device')}</Text>
                    <Text variant="caption" style={{ marginTop: scale(3), color: colors.brand.text.subtitle }}>
                        {t('last_active', 'Last active')}: {lastUsed}
                    </Text>
                    {locationLabel ? (
                        <Text variant="caption" style={{ marginTop: scale(2), color: colors.brand.text.subtitle }}>
                            {locationLabel}
                        </Text>
                    ) : null}
                    {session.ip ? (
                        <Text variant="caption" style={{ marginTop: scale(2), color: colors.brand.text.muted }}>
                            {session.ip}
                        </Text>
                    ) : null}
                </View>
                <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: scale(8), paddingVertical: scale(4), backgroundColor: session.current ? colors.chrome.toast.success.bg : colors.brand.bg.surface }}>
                    <Text variant="caption" className="font-body-semi" style={{ color: session.current ? colors.chrome.common.successStrong : colors.brand.text.subtitle }}>
                        {platformLabel}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function formatSessionLocation(session: UserSession): string | null {
    const code = session.locationCountryCode?.trim().toUpperCase();
    if (code) {
        let country = code;
        try {
            country = new (Intl as any).DisplayNames([i18n.language || 'en'], { type: 'region' }).of(code) || code;
        } catch {
            country = code;
        }

        const city = session.locationCity?.trim();
        return city ? `${city}, ${country}` : country;
    }

    return session.privateLocation ? t('session_private_location', 'Private location') : null;
}

function formatSessionDate(value?: string) {
    if (!value) return t('unknown', 'Unknown');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('unknown', 'Unknown');
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function NotificationRow({ label, description, value, disabled, onValueChange, isDark }: any) {
    const colors = useColors();
    return (
        <View style={{ marginTop: scale(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
                <View style={{ flex: 1 }}>
                    <Text variant="body" className="font-body-semi">{label}</Text>
                    <Text variant="caption" style={{ marginTop: scale(4), color: colors.brand.text.subtitle }}>
                        {description}
                    </Text>
                </View>
                <Switch
                    value={value}
                    disabled={disabled}
                    onValueChange={onValueChange}
                    trackColor={{ false: colors.brand.bg.border, true: colors.chrome.common.primaryGlow }}
                    thumbColor={value ? colors.chrome.primary : colors.chrome.common.inverseText}
                />
            </View>
        </View>
    );
}

function Row({ label, value, custom, isDark, embedded }: any) {
    const colors = useColors();
    return (
        <View style={embedded ? { marginTop: scale(10) } : { marginTop: scale(14), borderRadius: scale(14), padding: scale(14), backgroundColor: colors.chrome.common.card }}>
            <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>{label}</Text>
            {custom || <Text variant="body" style={{ marginTop: scale(4) }}>{value}</Text>}
        </View>
    );
}

function Action({ label, onPress, danger, isDark, disabled, embedded }: any) {
    const colors = useColors();
    return (
        <Pressable disabled={disabled} onPress={onPress} style={{ marginTop: embedded ? scale(8) : scale(10), borderRadius: scale(14), padding: scale(14), opacity: disabled ? 0.55 : 1, backgroundColor: embedded ? 'transparent' : colors.chrome.common.card }}>
            <Text variant="body" style={{ color: danger ? colors.brand.accent.error : colors.chrome.common.textStrong }}>{label}</Text>
        </Pressable>
    );
}
