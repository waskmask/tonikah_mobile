import React, { useState } from 'react';
import { Linking, ScrollView, Share, View } from 'react-native';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SettingsFieldSection } from '@/components/settings/SettingsFieldSection';
import { SettingsInfoRow, SettingsNavRow, SettingsToggleRow, formatSessionDate } from '@/components/settings/SettingsRows';
import { CalendarBlank, DownloadSimple, EnvelopeSimple, Eye, Scroll, ShieldCheck } from 'phosphor-react-native';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { accountService } from '@/lib/accountService';
import { apiMessage } from '@/lib/profileDisplay';
import { Config } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { fetchPrivacyConsent, SETTINGS_DATA_STALE_TIME_MS } from '@/lib/settingsQueries';

export default function SettingsPrivacyScreen() {
    const colors = useColors();
    const fieldIconColor = colors.chrome.common.textStrong;
    const toast = useToast();
    const user = useAuthStore((state) => state.user);
    const { currentLanguage } = useLanguage();
    const [marketingBusy, setMarketingBusy] = useState(false);
    const [exportingData, setExportingData] = useState(false);
    const isVisible = user?.visible !== false;
    const privacyQuery = useQuery({
        queryKey: queryKeys.settings.privacyConsent,
        queryFn: fetchPrivacyConsent,
        staleTime: SETTINGS_DATA_STALE_TIME_MS,
    });
    const privacyConsent = privacyQuery.data || null;

    const toggleMarketingOptIn = async (nextValue: boolean) => {
        if (!privacyConsent || marketingBusy) return;
        const previous = privacyConsent;
        setMarketingBusy(true);
        queryClient.setQueryData(queryKeys.settings.privacyConsent, {
            ...privacyConsent,
            marketingOptIn: nextValue,
        });
        const result = await accountService.updateMarketingOptIn(nextValue);
        setMarketingBusy(false);
        if (result.success) {
            if (result.consent) {
                queryClient.setQueryData(queryKeys.settings.privacyConsent, result.consent);
            }
            toast.show(
                nextValue
                    ? t('marketing_opt_in_enabled', 'Marketing emails enabled.')
                    : t('marketing_opt_in_disabled', 'Marketing emails disabled.'),
                'success',
                2500,
            );
        } else {
            queryClient.setQueryData(queryKeys.settings.privacyConsent, previous);
            toast.show(apiMessage(result.message || 'privacy_consent_update_failed'), 'error', 3500);
        }
    };

    const downloadMyData = async () => {
        if (exportingData) return;
        setExportingData(true);
        try {
            const result = await accountService.exportMe();
            if (result && (result.success === undefined || result.success)) {
                const { success: _success, ...payload } = result;
                await Share.share({
                    title: `tonikah-data-export-${new Date().toISOString().slice(0, 10)}.json`,
                    message: JSON.stringify(payload, null, 2),
                });
                toast.show(t('download_my_data_success', 'Your data export is ready.'), 'success', 3000);
            } else {
                toast.show(apiMessage(result?.message || 'download_my_data_error'), 'error', 3500);
            }
        } catch {
            // user dismissed the share sheet — not an error
        } finally {
            setExportingData(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('data_privacy', 'Data & privacy')} fallbackHref="/settings" showMenu />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 0, paddingBottom: scale(60) }}>
                <SettingsFieldSection title={t('account_visibility', 'Account visibility')}>
                    <SettingsInfoRow
                        icon={<Eye size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('account_visibility', 'Account visibility')}
                        value={isVisible
                            ? t('publicly_visible', 'Publicly visible')
                            : t('account_is_hidden', 'Account is hidden')}
                    />
                </SettingsFieldSection>

                <SettingsFieldSection title={t('marketing_emails', 'Marketing emails')}>
                    <SettingsToggleRow
                        icon={<EnvelopeSimple size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('marketing_emails', 'Marketing emails')}
                        description={t('marketing_emails_desc', 'Receive tips, feature updates and offers by email.')}
                        value={Boolean(privacyConsent?.marketingOptIn)}
                        disabled={marketingBusy || !privacyConsent}
                        onValueChange={toggleMarketingOptIn}
                    />
                </SettingsFieldSection>

                <SettingsFieldSection title={t('data_privacy', 'Data & privacy')}>
                    <SettingsInfoRow
                        icon={<Scroll size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('terms_version', 'Terms version')}
                        value={privacyConsent?.termsVersion || t('not_set', 'Not set')}
                    />
                    <SettingsInfoRow
                        icon={<ShieldCheck size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('privacy_version', 'Privacy version')}
                        value={privacyConsent?.privacyVersion || t('not_set', 'Not set')}
                        divider
                    />
                    <SettingsInfoRow
                        icon={<CalendarBlank size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('consent_date', 'Consent date')}
                        value={privacyConsent?.consentAt
                            ? formatSessionDate(privacyConsent.consentAt, currentLanguage)
                            : t('not_set', 'Not set')}
                        divider
                    />
                    <SettingsNavRow
                        icon={<DownloadSimple size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={exportingData ? t('please_wait', 'Please wait') : t('download_my_data', 'Download my data')}
                        disabled={exportingData}
                        loading={exportingData}
                        onPress={downloadMyData}
                        divider
                    />
                </SettingsFieldSection>

                <SettingsFieldSection title={t('settings_legal_title', 'Legal')}>
                    <SettingsNavRow
                        icon={<Scroll size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('terms_of_use', 'Terms of use')}
                        description={t(
                            'meta_description.terms',
                            'Review the account rules, acceptable conduct, and service conditions.',
                        )}
                        onPress={() => void Linking.openURL(Config.TERMS_URL)}
                    />
                    <SettingsNavRow
                        icon={<ShieldCheck size={scale(19)} color={fieldIconColor} weight="regular" />}
                        label={t('privacy_policy', 'Privacy Policy')}
                        description={t(
                            'meta_description.privacy_policy',
                            'Learn how we collect, use, and protect your personal data.',
                        )}
                        onPress={() => void Linking.openURL(Config.PRIVACY_URL)}
                        divider
                    />
                </SettingsFieldSection>
            </ScrollView>
        </View>
    );
}
