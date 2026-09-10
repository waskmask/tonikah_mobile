import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LogOut, RefreshCw, ShieldAlert, Smartphone, UserCog } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import {
    SettingsLockedRow,
    SettingsNavRow,
    SettingsValueRow,
    formatSessionDate,
    formatSessionLocation,
} from '@/components/settings/SettingsRows';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { displayText, t, translateCountry } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { authService, UserSession } from '@/lib/authService';

function formatDob(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

export default function SettingsAccountScreen() {
    const { user, logoutAllDevices, isLoading, refreshUser } = useAuthStore();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const toast = useToast();
    const [loggingOutOthers, setLoggingOutOthers] = useState(false);
    const [loggingOutAll, setLoggingOutAll] = useState(false);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessions, setSessions] = useState<UserSession[]>([]);

    const profile = user?.profile || {};
    const googleConnected = Boolean(user?.googleId);
    const profileManagerValue = profile?.profile_manager
        ? t(String(profile.profile_manager), displayText(String(profile.profile_manager)))
        : t('not_set', 'Not set');

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
        refreshSessions();
    }, [refreshSessions]);

    useFocusEffect(
        useCallback(() => {
            refreshSessions();
            refreshUser();
        }, [refreshSessions, refreshUser])
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
                            return;
                        }
                        toast.show(t('all_sessions_revoke_failed', 'Could not log out all devices. Please try again.'), 'error', 3500);
                    },
                },
            ]
        );
    };

    const otherSessions = sessions.filter((session) => !session.current);
    const activeCount = sessions.length;

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('account', 'Account')} fallbackHref="/(tabs)/settings" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(60) }}>
                <SectionCard title={t('personal_info', 'Personal Information')}>
                    <SettingsLockedRow
                        label={t('name', 'Name')}
                        value={String(profile?.profileName || profile?.profile_name || '')}
                    />
                    <SettingsLockedRow
                        label={t('gender', 'Gender')}
                        value={profile?.gender ? t(String(profile.gender), displayText(profile.gender)) : t('not_set', 'Not set')}
                    />
                    <SettingsLockedRow
                        label={t('dob', 'Date of Birth')}
                        value={formatDob(profile?.dob) || t('not_set', 'Not set')}
                    />
                    <SettingsLockedRow
                        label={t('grew_up_in', 'Grew up in')}
                        value={translateCountry(profile?.grew_up_in) || t('not_set', 'Not set')}
                    />
                </SectionCard>

                <SectionCard
                    title={t('account', 'Account')}
                    actionLabel={t('change_email_short', 'Change Email')}
                    onAction={() => router.push('/change-email' as any)}
                >
                    <SettingsValueRow
                        label={t('email', 'Email')}
                        value={user?.email || ''}
                        note={
                            googleConnected
                                ? `${t('google_account_connected', 'Google account connected.')} ${t('google_account_connected_desc', 'Changing your email address will not affect Google sign-in.')}`
                                : undefined
                        }
                    />
                    <SettingsValueRow label={t('language', 'Language')} custom={<LanguagePicker />} />
                </SectionCard>

                <SectionCard title={t('profile_manager', 'Profile manager')}>
                    <SettingsNavRow
                        icon={<UserCog size={scale(18)} color={primary} />}
                        label={t('profile_manager', 'Profile manager')}
                        description={profileManagerValue}
                        onPress={() => router.push({
                            pathname: '/(tabs)/edit-profile',
                            params: { returnTo: '/settings-account' },
                        })}
                    />
                </SectionCard>

                <SectionCard title={t('active_sessions', 'Active sessions')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
                        <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chrome.common.primaryTint }}>
                            <Smartphone size={scale(19)} color={primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>
                                {activeCount ? t('active_sessions_count', '{{count}} active session(s)', { count: activeCount }).replace('{{count}}', String(activeCount)) : t('active_sessions_desc', 'Manage where your account is currently logged in.')}
                            </Text>
                        </View>
                        <Pressable
                            onPress={refreshSessions}
                            disabled={sessionsLoading}
                            hitSlop={10}
                            style={{
                                width: scale(36),
                                height: scale(36),
                                borderRadius: scale(18),
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: sessionsLoading ? 0.5 : 1,
                                backgroundColor: colors.brand.bg.surface,
                            }}
                        >
                            {sessionsLoading ? <ActivityIndicator color={primary} size="small" /> : <RefreshCw size={scale(16)} color={primary} />}
                        </Pressable>
                    </View>

                    {sessionsLoading ? null : (
                        <View style={{ marginTop: scale(10), borderTopWidth: 1, borderTopColor: colors.brand.bg.border }}>
                            {sessions.length ? sessions.map((session) => (
                                <SessionRow key={session.id} session={session} />
                            )) : (
                                <Text variant="body-sm" style={{ marginTop: scale(12), color: colors.brand.text.subtitle }}>
                                    {t('no_active_sessions', 'No active sessions found.')}
                                </Text>
                            )}
                        </View>
                    )}

                    <View style={{ gap: scale(10), marginTop: scale(12) }}>
                        <SessionSecurityButton
                            label={loggingOutOthers ? t('please_wait', 'Please wait') : t('logout_other_devices', 'Log out other devices')}
                            description={t('logout_other_devices_hint', 'Keep this phone signed in and remove every other session.')}
                            icon={<LogOut size={scale(17)} color={primary} />}
                            disabled={loggingOutOthers || loggingOutAll || isLoading || otherSessions.length === 0}
                            onPress={confirmLogoutOtherDevices}
                        />
                        <SessionSecurityButton
                            label={loggingOutAll || isLoading ? t('please_wait', 'Please wait') : t('logout_all_devices', 'Log out all devices')}
                            description={t('logout_all_devices_hint', 'End every session and return to login on this phone.')}
                            icon={<ShieldAlert size={scale(17)} color={colors.brand.accent.error} />}
                            disabled={loggingOutAll || loggingOutOthers || isLoading}
                            onPress={confirmLogoutAllDevices}
                            danger
                        />
                    </View>
                </SectionCard>
            </ScrollView>
        </View>
    );
}

function SessionSecurityButton({ label, description, icon, disabled, onPress, danger }: {
    label: string;
    description: string;
    icon: React.ReactNode;
    disabled?: boolean;
    onPress: () => void;
    danger?: boolean;
}) {
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

function SessionRow({ session }: { session: UserSession }) {
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
