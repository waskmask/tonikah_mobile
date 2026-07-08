import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Share, View } from 'react-native';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsActionRow, SettingsToggleRow, formatSessionDate } from '@/components/settings/SettingsRows';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/profileDisplay';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { accountService, PrivacyConsent } from '@/lib/accountService';
import { apiMessage } from '@/lib/profileDisplay';
import { Config } from '@/constants/config';

export default function SettingsPrivacyScreen() {
    const colors = useColors();
    const toast = useToast();
    const [privacyConsent, setPrivacyConsent] = useState<PrivacyConsent | null>(null);
    const [marketingBusy, setMarketingBusy] = useState(false);
    const [exportingData, setExportingData] = useState(false);

    const refreshPrivacyConsent = useCallback(async () => {
        const result = await accountService.getPrivacyConsent();
        if (result.success && result.consent) {
            setPrivacyConsent(result.consent);
        }
    }, []);

    useEffect(() => {
        refreshPrivacyConsent();
    }, [refreshPrivacyConsent]);

    const toggleMarketingOptIn = async (nextValue: boolean) => {
        if (!privacyConsent || marketingBusy) return;
        const previous = privacyConsent;
        setMarketingBusy(true);
        setPrivacyConsent({ ...privacyConsent, marketingOptIn: nextValue });
        const result = await accountService.updateMarketingOptIn(nextValue);
        setMarketingBusy(false);
        if (result.success) {
            if (result.consent) setPrivacyConsent(result.consent);
            toast.show(
                nextValue
                    ? t('marketing_opt_in_enabled', 'Marketing emails enabled.')
                    : t('marketing_opt_in_disabled', 'Marketing emails disabled.'),
                'success',
                2500,
            );
        } else {
            setPrivacyConsent(previous);
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
            <AppBackTitleBar title={t('data_privacy', 'Data & privacy')} fallbackHref="/(tabs)/settings" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: scale(14), paddingTop: scale(18), paddingBottom: scale(60) }}>
                <SectionCard title={t('marketing_emails', 'Marketing emails')}>
                    <SettingsToggleRow
                        label={t('marketing_emails', 'Marketing emails')}
                        description={t('marketing_emails_desc', 'Receive tips, feature updates and offers by email.')}
                        value={Boolean(privacyConsent?.marketingOptIn)}
                        disabled={marketingBusy || !privacyConsent}
                        onValueChange={toggleMarketingOptIn}
                    />
                </SectionCard>

                <SectionCard title={t('data_privacy', 'Data & privacy')}>
                    {privacyConsent ? (
                        <View style={{ gap: scale(3) }}>
                            <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>
                                {t('terms_version', 'Terms version')}: {privacyConsent.termsVersion || t('not_set', 'Not set')}
                            </Text>
                            <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>
                                {t('privacy_version', 'Privacy version')}: {privacyConsent.privacyVersion || t('not_set', 'Not set')}
                            </Text>
                            <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>
                                {t('consent_date', 'Consent date')}: {privacyConsent.consentAt ? formatSessionDate(privacyConsent.consentAt) : t('not_set', 'Not set')}
                            </Text>
                        </View>
                    ) : null}
                    <SettingsActionRow
                        label={exportingData ? t('please_wait', 'Please wait') : t('download_my_data', 'Download my data')}
                        disabled={exportingData}
                        onPress={downloadMyData}
                    />
                </SectionCard>

                <SectionCard title={t('settings_legal_title', 'Legal')}>
                    <SettingsActionRow label={t('terms_of_use', 'Terms of use')} onPress={() => Linking.openURL(Config.TERMS_URL)} />
                    <SettingsActionRow label={t('privacy_policy', 'Privacy Policy')} onPress={() => Linking.openURL(Config.PRIVACY_URL)} />
                </SectionCard>
            </ScrollView>
        </View>
    );
}
