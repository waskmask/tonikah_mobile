import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LogOut, RefreshCw, ShieldAlert, Smartphone } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { EmailVerificationRequiredBanner } from '@/components/app/EmailVerificationRequiredBanner';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { t } from '@/lib/profileDisplay';
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
        <ScrollView style={{ flex: 1, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(120) }}>
            <Text variant="h2">{t('settings', 'Settings')}</Text>
            {!emailVerified ? (
                <View style={{ marginTop: scale(14) }}>
                    <EmailVerificationRequiredBanner
                        email={user?.email}
                        title={t('email_not_verified', 'Email not verified')}
                        message={emailNotVerifiedDesc}
                        actionLabel={t('verify_email', 'Verify Email-address Now')}
                    />
                </View>
            ) : null}
            <Row label={t('email', 'Email')} value={user?.email || ''} isDark={isDark} />
            <Row label={t('language', 'Language')} custom={<LanguagePicker />} isDark={isDark} />
            <NotificationRow
                label={t('chat:notifications_setting_title', 'Message notifications')}
                description={t('chat:notifications_setting_desc', 'Get alerts for new messages and requests.')}
                value={notificationsEnabled}
                disabled={notificationsBusy}
                onValueChange={toggleNotifications}
                isDark={isDark}
            />
            <SessionsSection
                sessions={sessions}
                loading={sessionsLoading}
                revokeOthersBusy={loggingOutOthers}
                revokeAllBusy={loggingOutAll || isLoading}
                onRefresh={refreshSessions}
                onRevokeOthers={confirmLogoutOtherDevices}
                onRevokeAll={confirmLogoutAllDevices}
                isDark={isDark}
            />
            <Action label={t('theme', 'Theme')} onPress={toggleTheme} isDark={isDark} />
            <Action label={t('blocked_users', 'Blocked users')} onPress={() => router.push('/(tabs)/blocked-users')} isDark={isDark} />
            <Action label={t('report_issue', 'Report issue')} onPress={() => router.push('/support')} isDark={isDark} />
            <Action label={t('logout', 'Logout')} danger disabled={isLoading} onPress={async () => { await logout(); router.replace('/(auth)/login'); }} isDark={isDark} />
        </ScrollView>
    );
}

function SessionsSection({ sessions, loading, revokeOthersBusy, revokeAllBusy, onRefresh, onRevokeOthers, onRevokeAll, isDark }: any) {
    const otherSessions = sessions.filter((session: UserSession) => !session.current);
    const borderColor = isDark ? '#1F2937' : '#E2E8F0';
    const muted = isDark ? '#94A3B8' : '#64748B';
    const activeCount = sessions.length;

    return (
        <View style={{ marginTop: scale(14), borderRadius: scale(18), padding: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
                <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#1F2937' : '#FFF1F4' }}>
                    <Smartphone size={scale(19)} color="#F34B6F" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text variant="body" className="font-body-bold">{t('active_sessions', 'Active sessions')}</Text>
                    <Text variant="caption" style={{ marginTop: scale(4), color: muted }}>
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
                        backgroundColor: isDark ? '#1F2937' : '#F8FAFC',
                    }}
                >
                    {loading ? <ActivityIndicator color="#F34B6F" size="small" /> : <RefreshCw size={scale(16)} color="#F34B6F" />}
                </Pressable>
            </View>

            {loading ? (
                null
            ) : (
                <View style={{ marginTop: scale(10), borderTopWidth: 1, borderTopColor: borderColor }}>
                    {sessions.length ? sessions.map((session: UserSession) => (
                        <SessionRow key={session.id} session={session} isDark={isDark} />
                    )) : (
                        <Text variant="body-sm" style={{ marginTop: scale(12), color: isDark ? '#94A3B8' : '#64748B' }}>
                            {t('no_active_sessions', 'No active sessions found.')}
                        </Text>
                    )}
                </View>
            )}

            <View style={{ gap: scale(10), marginTop: scale(12) }}>
                <SessionSecurityButton
                    label={revokeOthersBusy ? t('please_wait', 'Please wait') : t('logout_other_devices', 'Log out other devices')}
                    description={t('logout_other_devices_hint', 'Keep this phone signed in and remove every other session.')}
                    icon={<LogOut size={scale(17)} color="#F34B6F" />}
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
        </View>
    );
}

function SessionSecurityButton({ label, description, icon, disabled, onPress, isDark, danger }: any) {
    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            style={{
                borderRadius: scale(14),
                borderWidth: 1,
                borderColor: danger ? '#FECACA' : (isDark ? '#334155' : '#E2E8F0'),
                padding: scale(12),
                opacity: disabled ? 0.55 : 1,
                backgroundColor: danger ? (isDark ? '#2A1220' : '#FFF1F4') : (isDark ? '#0F172A' : '#FFFFFF'),
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
                <View style={{ width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? '#FFE4E6' : '#FFF1F4' }}>
                    {icon}
                </View>
                <View style={{ flex: 1 }}>
                    <Text variant="body-sm" className="font-body-semi" style={{ color: danger ? '#E11D48' : undefined }}>
                        {label}
                    </Text>
                    <Text variant="caption" style={{ marginTop: scale(3), color: isDark ? '#94A3B8' : '#64748B' }}>
                        {description}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

function SessionRow({ session, isDark }: { session: UserSession; isDark: boolean }) {
    const lastUsed = formatSessionDate(session.lastUsedAt || session.createdAt);
    const platformLabel = session.current
        ? t('current_device', 'Current device')
        : t('other_device', 'Other device');

    return (
        <View style={{ paddingVertical: scale(12), borderBottomWidth: 1, borderBottomColor: isDark ? '#1F2937' : '#E2E8F0' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: scale(12) }}>
                <View style={{ flex: 1 }}>
                    <Text variant="body-sm" className="font-body-semi">{session.label || t('unknown_device', 'Unknown device')}</Text>
                    <Text variant="caption" style={{ marginTop: scale(3), color: isDark ? '#94A3B8' : '#64748B' }}>
                        {t('last_active', 'Last active')}: {lastUsed}
                    </Text>
                    {session.ip ? (
                        <Text variant="caption" style={{ marginTop: scale(2), color: isDark ? '#64748B' : '#94A3B8' }}>
                            {session.ip}
                        </Text>
                    ) : null}
                </View>
                <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: scale(8), paddingVertical: scale(4), backgroundColor: session.current ? '#DCFCE7' : (isDark ? '#1F2937' : '#F1F5F9') }}>
                    <Text variant="caption" className="font-body-semi" style={{ color: session.current ? '#15803D' : (isDark ? '#CBD5E1' : '#64748B') }}>
                        {platformLabel}
                    </Text>
                </View>
            </View>
        </View>
    );
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
    return (
        <View style={{ marginTop: scale(14), borderRadius: scale(14), padding: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
                <View style={{ flex: 1 }}>
                    <Text variant="body" className="font-body-semi">{label}</Text>
                    <Text variant="caption" style={{ marginTop: scale(4), color: isDark ? '#94A3B8' : '#64748B' }}>
                        {description}
                    </Text>
                </View>
                <Switch
                    value={value}
                    disabled={disabled}
                    onValueChange={onValueChange}
                    trackColor={{ false: '#CBD5E1', true: '#F9A8BA' }}
                    thumbColor={value ? '#F34B6F' : '#FFFFFF'}
                />
            </View>
        </View>
    );
}

function Row({ label, value, custom, isDark }: any) {
    return (
        <View style={{ marginTop: scale(14), borderRadius: scale(14), padding: scale(14), backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
            <Text variant="caption" style={{ color: isDark ? '#94A3B8' : '#64748B' }}>{label}</Text>
            {custom || <Text variant="body" style={{ marginTop: scale(4) }}>{value}</Text>}
        </View>
    );
}

function Action({ label, onPress, danger, isDark, disabled }: any) {
    return (
        <Pressable disabled={disabled} onPress={onPress} style={{ marginTop: scale(10), borderRadius: scale(14), padding: scale(14), opacity: disabled ? 0.55 : 1, backgroundColor: isDark ? '#111827' : '#FFFFFF' }}>
            <Text variant="body" style={{ color: danger ? '#E11D48' : undefined }}>{label}</Text>
        </Pressable>
    );
}
