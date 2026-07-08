import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { accountService, PrivacyConsent } from '@/lib/accountService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { Config } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';

/**
 * Blocking modal shown when the accepted terms/privacy versions are older than
 * the current ones (parity with the web LegalConsentGate). Mounted once in the
 * tabs layout so it only gates the logged-in app.
 */
export function LegalConsentGate() {
    const colors = useColors();
    const toast = useToast();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const [consent, setConsent] = useState<PrivacyConsent | null>(null);
    const [visible, setVisible] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [saving, setSaving] = useState(false);

    const check = useCallback(async () => {
        const result = await accountService.getPrivacyConsent();
        if (result.success && result.consent) {
            setConsent(result.consent);
            setVisible(Boolean(result.consent.requiresReaccept));
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) void check();
        else setVisible(false);
    }, [isAuthenticated, check]);

    const acceptLatest = async () => {
        if (!agreed || saving) return;
        setSaving(true);
        const result = await accountService.acceptLatestConsent();
        setSaving(false);
        if (result.success) {
            toast.show(apiMessage(result.message || 'legal_consent_updated'), 'success', 3000);
            setVisible(false);
        } else {
            toast.show(apiMessage(result.message || 'legal_consent_update_failed'), 'error', 3500);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible transparent animationType="fade">
            <View style={styles.backdrop}>
                <View style={[styles.card, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}>
                    <View style={styles.headerRow}>
                        <View style={[styles.icon, { backgroundColor: colors.chrome.toast.success.bg }]}>
                            <ShieldCheck size={scale(22)} color={colors.chrome.common.successStrong} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="h3">{t('legal_consent_title', 'Updated terms & privacy')}</Text>
                        </View>
                    </View>
                    <Text variant="body-sm" className="font-body-semi" style={{ marginTop: scale(12) }}>
                        {t('legal_consent_subtitle', 'We updated our legal documents')}
                    </Text>
                    <Text variant="body-sm" style={{ marginTop: scale(6), color: colors.brand.text.subtitle }}>
                        {t('legal_consent_desc', 'Please review and accept the latest Terms of Use and Privacy Policy to continue.')}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: scale(8), marginTop: scale(12) }}>
                        <VersionPill label={t('terms_version', 'Terms version')} value={consent?.currentTermsVersion || t('not_set', 'Not set')} />
                        <VersionPill label={t('privacy_version', 'Privacy version')} value={consent?.currentPrivacyVersion || t('not_set', 'Not set')} />
                    </View>

                    <Pressable onPress={() => setAgreed((value) => !value)} style={[styles.checkboxRow, { borderColor: colors.brand.bg.border }]}>
                        <View
                            style={[
                                styles.checkbox,
                                { borderColor: agreed ? colors.chrome.primary : colors.brand.bg.border },
                                agreed && { backgroundColor: colors.chrome.primary },
                            ]}
                        />
                        <Text variant="caption" style={{ flex: 1, color: colors.brand.text.subtitle }}>
                            {t('legal_consent_checkbox', 'I have read and agree to the latest Terms of Use and Privacy Policy.')}
                        </Text>
                    </Pressable>

                    <View style={styles.linksRow}>
                        <Pressable onPress={() => Linking.openURL(Config.TERMS_URL)} hitSlop={6}>
                            <Text variant="caption" className="font-body-bold" style={{ color: colors.brand.accent.link, textDecorationLine: 'underline' }}>
                                {t('terms_of_use', 'Terms of use')}
                            </Text>
                        </Pressable>
                        <Pressable onPress={() => Linking.openURL(Config.PRIVACY_URL)} hitSlop={6}>
                            <Text variant="caption" className="font-body-bold" style={{ color: colors.brand.accent.link, textDecorationLine: 'underline' }}>
                                {t('privacy_policy', 'Privacy Policy')}
                            </Text>
                        </Pressable>
                    </View>

                    <Pressable
                        disabled={!agreed || saving}
                        onPress={acceptLatest}
                        style={[styles.acceptButton, { backgroundColor: colors.chrome.primary, opacity: !agreed || saving ? 0.55 : 1 }]}
                    >
                        {saving
                            ? <ActivityIndicator size="small" color={colors.chrome.common.inverseText} />
                            : (
                                <Text variant="body-sm" className="font-body-bold" style={{ color: colors.chrome.common.inverseText }}>
                                    {t('legal_consent_accept', 'Accept and continue')}
                                </Text>
                            )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

function VersionPill({ label, value }: { label: string; value: string }) {
    const colors = useColors();
    return (
        <View style={[styles.pill, { borderColor: colors.brand.bg.border, backgroundColor: colors.brand.bg.surface }]}>
            <Text variant="caption" style={{ color: colors.brand.text.muted }}>{label}</Text>
            <Text variant="caption" className="font-body-bold" style={{ marginTop: scale(2) }}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: scale(18) },
    card: { width: '100%', maxWidth: scale(440), borderRadius: scale(18), borderWidth: StyleSheet.hairlineWidth, padding: scale(18) },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
    icon: { width: scale(44), height: scale(44), borderRadius: scale(14), alignItems: 'center', justifyContent: 'center' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10), marginTop: scale(14), borderWidth: StyleSheet.hairlineWidth, borderRadius: scale(12), padding: scale(12) },
    checkbox: { width: scale(20), height: scale(20), borderRadius: scale(6), borderWidth: 2 },
    linksRow: { flexDirection: 'row', gap: scale(16), marginTop: scale(12) },
    acceptButton: { marginTop: scale(16), minHeight: scale(48), borderRadius: scale(24), alignItems: 'center', justifyContent: 'center' },
    pill: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: scale(10), paddingHorizontal: scale(10), paddingVertical: scale(8) },
});
