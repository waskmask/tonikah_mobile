import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, CreditCard, Footprints, LogOut, RefreshCw, ShieldAlert, Smartphone, User, UserCog, VenusAndMars } from '@/components/ui/icons/PhosphorCompat';
import { EnvelopeSimple, Translate } from 'phosphor-react-native';
import { Text } from '@/components/ui/Text';
import { SingleSelectSheet } from '@/components/ui/SingleSelectSheet';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { InlineLoadError } from '@/components/ui/InlineLoadError';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SettingsFieldSection } from '@/components/settings/SettingsFieldSection';
import {
    SettingsInfoRow,
    SettingsNavRow,
    formatSessionDate,
    formatSessionLocation,
} from '@/components/settings/SettingsRows';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { apiMessage, displayText, t, translateCountry } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { UserSession } from '@/lib/authService';
import { profileService } from '@/lib/profileService';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { normalizeProfileManager } from '@/lib/profileManager';
import { SUPPORTED_APP_LANGUAGES } from '@/lib/languageNames';
import { useQuery } from '@tanstack/react-query';
import { fetchActiveSessions, SETTINGS_DATA_STALE_TIME_MS } from '@/lib/settingsQueries';

const PROFILE_MANAGER_OPTIONS = ['self', 'father', 'mother', 'brother', 'sister', 'relative', 'friend'] as const;

function formatDob(value: string | undefined, locale: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
}

export default function SettingsAccountScreen() {
    const { user, logoutOtherDevices, logoutAllDevices, isLoading, refreshUser, patchUserProfile } = useAuthStore();
    const colors = useColors();
    const primary = colors.chrome.primary;
    const fieldIconColor = colors.chrome.common.textStrong;
    const toast = useToast();
    const { currentLanguage } = useLanguage();
    const { requireVerified } = useEmailVerificationGuard();
    const [profileManagerOpen, setProfileManagerOpen] = useState(false);
    const [sessionConfirmation, setSessionConfirmation] = useState<'others' | 'all' | null>(null);
    const [profileManagerSaving, setProfileManagerSaving] = useState(false);
    const [loggingOutOthers, setLoggingOutOthers] = useState(false);
    const [loggingOutAll, setLoggingOutAll] = useState(false);
    const sessionsQuery = useQuery({
        queryKey: queryKeys.settings.activeSessions,
        queryFn: fetchActiveSessions,
        staleTime: SETTINGS_DATA_STALE_TIME_MS,
    });
    const sessions = sessionsQuery.data || [];
    const sessionsLoading = sessionsQuery.isFetching;
    const sessionsUnavailable = sessionsQuery.isError && !sessions.length;

    const profile = user?.profile || {};
    const googleConnected = Boolean(user?.googleId);
    const profileManagerKey = normalizeProfileManager(profile?.profile_manager);
    const profileManagerValue = profileManagerKey
        ? t(profileManagerKey, displayText(profileManagerKey))
        : t('not_set', 'Not set');
    const language = SUPPORTED_APP_LANGUAGES.find((item) => item.code === currentLanguage)
        || SUPPORTED_APP_LANGUAGES[0];
    const languageLabel = String(t(language.translationKey) || language.name);

    const refreshSessions = useCallback(async () => {
        await sessionsQuery.refetch();
    }, [sessionsQuery.refetch]);

    useFocusEffect(
        useCallback(() => {
            refreshUser();
        }, [refreshUser])
    );

    const confirmLogoutOtherDevices = async () => {
        setLoggingOutOthers(true);
        const result = await logoutOtherDevices();
        setLoggingOutOthers(false);
        if (result.success) {
            setSessionConfirmation(null);
            toast.show(t('other_sessions_revoked', 'Other devices have been logged out.'), 'success', 3000);
            await queryClient.invalidateQueries({ queryKey: queryKeys.settings.activeSessions });
        } else {
            toast.show(t('sessions_revoke_failed', 'Could not log out other devices. Please try again.'), 'error', 3500);
        }
    };

    const confirmLogoutAllDevices = async () => {
        setLoggingOutAll(true);
        const result = await logoutAllDevices();
        setLoggingOutAll(false);
        if (result.success) {
            setSessionConfirmation(null);
            toast.show(t('all_sessions_revoked', 'You have been logged out on all devices.'), 'success', 3000);
            return;
        }
        toast.show(t('all_sessions_revoke_failed', 'Could not log out all devices. Please try again.'), 'error', 3500);
    };

    const otherSessions = sessions.filter((session) => !session.current);
    const activeCount = sessions.length;
    const profileManagerOptions = PROFILE_MANAGER_OPTIONS.map((value) => ({
        value,
        label: t(value, displayText(value)),
    }));

    const saveProfileManager = async (value: string) => {
        if (!requireVerified('save')) return;

        setProfileManagerSaving(true);
        try {
            const response = await profileService.updateProfile({
                profile_manager: value,
                clientLocale: currentLanguage,
            });
            if (response.success === false) {
                toast.show(
                    apiMessage(String(response.message || ''), t('profile.update_error', 'Could not update profile.')),
                    'error',
                );
                return;
            }

            const responseProfile = response.profile || response.user?.profile || {};
            patchUserProfile({ ...responseProfile, profile_manager: responseProfile.profile_manager ?? value });
            toast.show(t('profile.profile_updated', 'Profile updated.'), 'success');
            void Promise.allSettled([
                refreshUser(),
                queryClient.invalidateQueries({ queryKey: queryKeys.profile.mySummary }),
            ]);
        } catch (error) {
            toast.show(
                apiMessage(String((error as any)?.message || ''), t('profile.update_error', 'Could not update profile.')),
                'error',
            );
        } finally {
            setProfileManagerSaving(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('account', 'Account')} fallbackHref="/settings" showMenu />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 0, paddingBottom: scale(60) }}>
                <SettingsFieldSection title={t('personal_info', 'Personal Information')}>
                    <SettingsInfoRow
                        icon={<User size={scale(19)} color={fieldIconColor} />}
                        label={t('name', 'Name')}
                        value={String(profile?.profileName || profile?.profile_name || '')}
                        locked
                    />
                    <SettingsInfoRow
                        icon={<VenusAndMars size={scale(19)} color={fieldIconColor} />}
                        label={t('gender', 'Gender')}
                        value={profile?.gender ? t(String(profile.gender), displayText(profile.gender)) : t('not_set', 'Not set')}
                        locked
                        divider
                    />
                    <SettingsInfoRow
                        icon={<CalendarDays size={scale(19)} color={fieldIconColor} />}
                        label={t('dob', 'Date of Birth')}
                        value={formatDob(profile?.dob, currentLanguage) || t('not_set', 'Not set')}
                        locked
                        divider
                    />
                    <SettingsInfoRow
                        icon={<Footprints size={scale(19)} color={fieldIconColor} />}
                        label={t('grew_up_in', 'Grew up in')}
                        value={translateCountry(profile?.grew_up_in) || t('not_set', 'Not set')}
                        locked
                        divider
                    />
                </SettingsFieldSection>

                <SettingsFieldSection
                    title={t('account', 'Account')}
                    actionLabel={t('change_email_short', 'Change Email')}
                    onAction={() => router.push('/change-email' as any)}
                >
                    <SettingsInfoRow
                        icon={<EnvelopeSimple size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('email', 'Email')}
                        value={user?.email || ''}
                        note={
                            googleConnected
                                ? `${t('google_account_connected', 'Google account connected.')} ${t('google_account_connected_desc', 'Changing your email address will not affect Google sign-in.')}`
                                : undefined
                        }
                    />
                    <SettingsNavRow
                        icon={<Translate size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('language', 'Language')}
                        description={`${language.flag} ${languageLabel}`}
                        onPress={() => router.push('/language')}
                        divider
                    />
                </SettingsFieldSection>

                <SettingsFieldSection title={t('profile_manager', 'Profile manager')}>
                    <SettingsNavRow
                        icon={<UserCog size={scale(18)} color={fieldIconColor} />}
                        label={t('profile_manager', 'Profile manager')}
                        description={profileManagerValue}
                        onPress={() => setProfileManagerOpen(true)}
                        disabled={profileManagerSaving}
                        loading={profileManagerSaving}
                    />
                </SettingsFieldSection>

                <SettingsFieldSection title={t('membership_billing', 'Membership & billing')}>
                    <SettingsNavRow
                        icon={<CreditCard size={scale(18)} color={fieldIconColor} />}
                        label={t('membership_billing', 'Membership & billing')}
                        description={t('membership_billing_desc', 'Membership details and payment history.')}
                        onPress={() => router.push({ pathname: '/memberships', params: { view: 'details' } })}
                    />
                </SettingsFieldSection>

                <SettingsFieldSection title={t('active_sessions', 'Active sessions')} contentInset>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
                        <View style={{ width: scale(40), height: scale(40), borderRadius: scale(8), alignItems: 'center', justifyContent: 'center', backgroundColor: colors.chrome.header.iconBackground }}>
                            <Smartphone size={scale(19)} color={fieldIconColor} />
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

                    {!sessions.length && sessionsLoading ? null : sessionsUnavailable ? (
                        <View style={{ paddingTop: scale(18), paddingBottom: scale(6) }}>
                            <InlineLoadError
                                title={t('sessions_load_failed', 'Could not load active sessions.')}
                                description={t('network_error', 'No internet connection. Please check and try again.')}
                                retryLabel={t('btn_try_again', 'Try Again')}
                                onRetry={() => void refreshSessions()}
                            />
                        </View>
                    ) : (
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

                    <View style={{ gap: scale(10), marginTop: scale(12), display: sessionsUnavailable ? 'none' : 'flex' }}>
                        <SessionSecurityButton
                            label={loggingOutOthers ? t('please_wait', 'Please wait') : t('logout_other_devices', 'Log out other devices')}
                            description={t('logout_other_devices_hint', 'Keep this phone signed in and remove every other session.')}
                            icon={<LogOut size={scale(17)} color={primary} />}
                            disabled={loggingOutOthers || loggingOutAll || isLoading || otherSessions.length === 0}
                            onPress={() => setSessionConfirmation('others')}
                        />
                        <SessionSecurityButton
                            label={loggingOutAll || isLoading ? t('please_wait', 'Please wait') : t('logout_all_devices', 'Log out all devices')}
                            description={t('logout_all_devices_hint', 'End every session and return to login on this phone.')}
                            icon={<ShieldAlert size={scale(17)} color={colors.brand.accent.error} />}
                            disabled={loggingOutAll || loggingOutOthers || isLoading}
                            onPress={() => setSessionConfirmation('all')}
                            danger
                        />
                    </View>
                </SettingsFieldSection>
            </ScrollView>

            <SingleSelectSheet
                visible={profileManagerOpen}
                onClose={() => setProfileManagerOpen(false)}
                onSelect={(value) => void saveProfileManager(value)}
                options={profileManagerOptions}
                selected={profileManagerKey}
                title={t('profile_manager', 'Profile manager')}
            />
            <ConfirmSheet
                visible={sessionConfirmation !== null}
                onClose={() => setSessionConfirmation(null)}
                onConfirm={() => {
                    if (sessionConfirmation === 'others') void confirmLogoutOtherDevices();
                    if (sessionConfirmation === 'all') void confirmLogoutAllDevices();
                }}
                title={sessionConfirmation === 'all'
                    ? t('logout_all_devices', 'Log out all devices')
                    : t('logout_other_devices', 'Log out other devices')}
                message={sessionConfirmation === 'all'
                    ? t('logout_all_devices_confirm', 'This will sign you out on every device, including this phone.')
                    : t('logout_other_devices_confirm', 'This will sign you out on all other devices. This phone will stay logged in.')}
                confirmLabel={t('logout', 'Logout')}
                cancelLabel={t('cancel', 'Cancel')}
                confirmLoading={sessionConfirmation === 'all' ? loggingOutAll : loggingOutOthers}
            />
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
    const { currentLanguage } = useLanguage();
    const lastUsed = formatSessionDate(session.lastUsedAt || session.createdAt, currentLanguage);
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
