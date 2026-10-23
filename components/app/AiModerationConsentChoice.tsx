import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { accountService, type PrivacyConsent } from '@/lib/accountService';
import { Config } from '@/constants/config';
import { useColors } from '@/hooks/useColors';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/lib/profileDisplay';
import { Check, ShieldCheck, X } from 'phosphor-react-native';
import { SettingsToggleRow } from '@/components/settings/SettingsRows';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';

export function AiModerationConsentChoice({ consent, onSaved, settings = false, recommendSelectedAi = false }: {
    consent: NonNullable<PrivacyConsent['aiModeration']>;
    onSaved: (consent: PrivacyConsent) => void;
    settings?: boolean;
    recommendSelectedAi?: boolean;
}) {
    const colors = useColors();
    const [saving, setSaving] = useState<boolean | null>(null);
    const [error, setError] = useState(false);
    const savingRef = useRef(false);
    const [detailsMode, setDetailsMode] = useState<'read' | 'disable' | null>(null);
    const choose = async (allowed: boolean) => {
        if (savingRef.current) return;
        savingRef.current = true;
        const user = useAuthStore.getState().user;
        const accountId = user?._id || user?.id;
        setSaving(allowed);
        setError(false);
        try {
            const response = await accountService.updateAiModerationConsent(allowed, consent.currentVersion);
            const current = useAuthStore.getState().user;
            if ((current?._id || current?.id) !== accountId) return;
            if (response.success && response.consent?.aiModeration?.allowed === allowed && !response.consent.aiModeration.requiresDecision) {
                await queryClient.cancelQueries({ queryKey: queryKeys.settings.privacyConsent });
                const latest = useAuthStore.getState().user;
                if ((latest?._id || latest?.id) !== accountId) return;
                queryClient.setQueryData(queryKeys.settings.privacyConsent, response.consent);
                onSaved(response.consent);
            }
            else setError(true);
        } catch {
            setError(true);
        } finally {
            savingRef.current = false;
            setSaving(null);
        }
    };

    if (settings) return (
        <>
            <SettingsToggleRow
                icon={<ShieldCheck size={19} color={consent.allowed === true ? colors.chrome.common.textStrong : colors.chrome.toast.warning.icon} />}
                label={t('ai_review_allow', 'Allow AI checks')}
                value={consent.allowed === true}
                busy={saving !== null}
                disabled={saving !== null}
                onValueChange={(allowed) => allowed ? void choose(true) : setDetailsMode('disable')}
                descriptionContent={<>
                    {consent.allowed !== true ? <View style={[styles.recommended, { alignSelf: 'flex-start', backgroundColor: colors.chrome.toast.warning.bg, borderColor: colors.chrome.toast.warning.border }]}>
                        <Text variant="caption" style={{ color: colors.chrome.toast.warning.text }}>{t('membership_recommended', 'Recommended')}</Text>
                    </View> : null}
                    <Text variant="caption" numberOfLines={2} style={{ color: colors.brand.text.subtitle }}>
                        {t('ai_review_disclosure', 'With your permission, we send profile photos and your Headline, Bio, Company and About Partner text to OpenAI or Google Gemini, depending on the content, for safety checks and to assist admin review. Providers may retain submitted content and technical data under their applicable terms and settings. These checks do not verify your identity.')}
                    </Text>
                    <Pressable onPress={() => setDetailsMode('read')} accessibilityRole="button" hitSlop={8}>
                        <Text variant="caption" style={{ color: colors.brand.accent.link }}>{t('read_more', 'Read more')}</Text>
                    </Pressable>
                </>}
            />
            {error ? <Text variant="caption" accessibilityRole="alert" style={{ color: colors.brand.accent.error, paddingHorizontal: 16 }}>{t('ai_review_save_error', 'Could not save your choice. Please try again. Content stays in admin review without permission.')}</Text> : null}
            <Modal visible={detailsMode !== null} transparent animationType="fade" onRequestClose={() => setDetailsMode(null)}>
                <View style={styles.backdrop}>
                    <View style={[styles.dialog, { backgroundColor: colors.chrome.common.card }]}>
                        <Pressable onPress={() => setDetailsMode(null)} accessibilityRole="button" accessibilityLabel={t('close', 'Close')} hitSlop={8} style={styles.close}>
                            <X size={22} color={colors.chrome.common.textStrong} />
                        </Pressable>
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
                            <AiModerationConsentChoice consent={consent} recommendSelectedAi={detailsMode === 'disable'} onSaved={(next) => { onSaved(next); setDetailsMode(null); }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );

    return (
        <View style={styles.content}>
            <Text variant="h3" style={{ color: colors.chrome.common.textStrong }}>{t('ai_review_title', 'AI content safety checks')}</Text>
            <Text variant="body-sm" style={{ color: colors.brand.text.subtitle }}>
                {t('ai_review_disclosure', 'With your permission, we send profile photos and your Headline, Bio, Company and About Partner text to OpenAI or Google Gemini, depending on the content, for safety checks and to assist admin review. Providers may retain submitted content and technical data under their applicable terms and settings. These checks do not verify your identity.')}
            </Text>
            <Text variant="body-sm" style={{ color: colors.brand.text.subtitle }}>
                {t('ai_review_choice', 'AI checks usually help publish approved content faster. If you choose admin review instead, no content will be sent to AI providers for these checks, and new content will stay hidden until approved. You can change your choice in Data & privacy. Changes apply to future checks.')}
            </Text>
            <Pressable onPress={() => void Linking.openURL(Config.PRIVACY_URL)} accessibilityRole="link">
                <Text variant="body-sm" style={{ color: colors.brand.accent.link, textDecorationLine: 'underline' }}>
                    {t('privacy_policy', 'Privacy Policy')}
                </Text>
            </Pressable>
            {error ? <Text variant="body-sm" accessibilityRole="alert" style={{ color: colors.brand.accent.error }}>{t('ai_review_save_error', 'Could not save your choice. Please try again. Content stays in admin review without permission.')}</Text> : null}
            {[true, false].map((allowed) => (
                <Pressable key={String(allowed)} onPress={() => void choose(allowed)} disabled={saving !== null}
                    accessibilityRole="button" accessibilityState={{ disabled: saving !== null, selected: consent.allowed === allowed }}
                    style={[styles.button, {
                        borderColor: consent.allowed === allowed ? colors.chrome.primary : colors.brand.bg.border,
                        backgroundColor: consent.allowed === allowed ? colors.chrome.common.primaryTint : colors.chrome.common.card,
                        opacity: saving !== null ? 0.6 : 1,
                    }]}>
                    {consent.allowed === allowed ? <View style={styles.selectedIcon}><Check size={18} weight="bold" color={colors.chrome.primary} /></View> : null}
                    {saving === allowed ? <ActivityIndicator color={colors.chrome.primary} /> : <View style={styles.buttonContent}>
                        <Text variant="body-sm" className="font-body-semi" style={{ color: colors.chrome.common.textStrong, textAlign: 'center' }}>{allowed ? t('ai_review_allow', 'Allow AI checks') : t('ai_review_decline', 'Use admin review instead')}</Text>
                        {allowed && (consent.allowed !== true || recommendSelectedAi) ? <View style={[styles.recommended, { backgroundColor: colors.chrome.toast.warning.bg, borderColor: colors.chrome.toast.warning.border }]}>
                            <Text variant="caption" style={{ color: colors.chrome.toast.warning.text }}>{t('membership_recommended', 'Recommended')}</Text>
                        </View> : null}
                    </View>}
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    content: { gap: 12 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', padding: 24, justifyContent: 'center', alignItems: 'center' },
    dialog: { width: '100%', maxWidth: 440, maxHeight: '85%', borderRadius: 8, overflow: 'hidden' },
    close: { alignSelf: 'flex-end', padding: 12 },
    buttonContent: { alignItems: 'center', gap: 5, width: '100%' },
    selectedIcon: { position: 'absolute', end: 10, top: 10 },
    recommended: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
    button: { minHeight: 48, paddingHorizontal: 32, paddingVertical: 10, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
