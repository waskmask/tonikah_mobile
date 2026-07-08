import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { Text } from '@/components/ui/Text';
import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import { GradientButton } from '@/components/ui/GradientButton';
import { accountService } from '@/lib/accountService';
import { apiMessage, t } from '@/lib/profileDisplay';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/useToast';
import { scale } from '@/hooks/useResponsive';
import { Typography } from '@/constants/typography';

const REASONS = [
    'delete_reason_found_match',
    'delete_reason_married',
    'delete_reason_take_break',
    'delete_reason_privacy_concerns',
    'delete_reason_not_serious_users',
    'delete_reason_too_expensive',
    'delete_reason_not_useful',
    'delete_reason_technical_issue',
    'delete_reason_inappropriate_behavior',
    'delete_reason_support_issue',
    'delete_reason_other',
];

export default function DeleteAccountScreen() {
    const colors = useColors();
    const toast = useToast();
    const { currentLanguage, isRTL } = useLanguage();
    const logout = useAuthStore((state) => state.logout);
    const [reason, setReason] = useState('');
    const [otherText, setOtherText] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const inputFontFamily = currentLanguage === 'ar' ? Typography.font.arabic.regular : Typography.font.body.regular;

    const submitReason = () => {
        if (!reason) {
            toast.show(t('delete_reason_required', 'Please select a reason.'), 'error', 3000);
            return;
        }
        if (reason === 'delete_reason_other' && !otherText.trim()) {
            toast.show(t('delete_reason_other_required', 'Please tell us more.'), 'error', 3000);
            return;
        }
        setConfirmText('');
        setConfirmOpen(true);
    };

    const deleteAccount = async () => {
        if (deleting || confirmText !== 'DELETE') return;
        setDeleting(true);
        const deletedReason = reason === 'delete_reason_other' ? `delete_reason_other: ${otherText.trim()}` : reason;
        const result = await accountService.deleteMe(deletedReason, currentLanguage);
        if (result.success) {
            toast.show(apiMessage(result.message || 'account_deleted'), 'success', 3000);
            await logout();
            router.replace('/(auth)/login' as any);
            return;
        }
        setDeleting(false);
        setConfirmOpen(false);
        toast.show(apiMessage(result.message || 'something_went_wrong'), 'error', 3500);
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.brand.bg.surface }}>
            <AppBackTitleBar title={t('delete_account', 'Delete account')} fallbackHref="/(tabs)/settings" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: scale(14), paddingBottom: scale(120) }}>
                <View style={[styles.reasonsCard, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}>
                    {REASONS.map((key, index) => {
                        const active = reason === key;
                        return (
                            <Pressable
                                key={key}
                                onPress={() => setReason(key)}
                                style={[
                                    styles.reasonRow,
                                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.brand.bg.border },
                                    active && { backgroundColor: colors.chrome.common.primaryTint },
                                ]}
                            >
                                <Text
                                    variant="body-sm"
                                    className="font-body-semi"
                                    style={{ flex: 1, color: active ? colors.chrome.primary : colors.chrome.common.textStrong }}
                                >
                                    {t(key, key)}
                                </Text>
                                <View
                                    style={[
                                        styles.radio,
                                        { borderColor: active ? colors.chrome.primary : colors.brand.bg.border },
                                        active && { borderWidth: scale(6) },
                                    ]}
                                />
                            </Pressable>
                        );
                    })}
                </View>

                {reason === 'delete_reason_other' ? (
                    <View style={[styles.otherBox, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}>
                        <TextInput
                            value={otherText}
                            onChangeText={(value) => setOtherText(value.slice(0, 250))}
                            multiline
                            placeholder={t('delete_reason_other_placeholder', 'Tell us what happened...')}
                            placeholderTextColor={colors.brand.text.muted}
                            style={[styles.otherInput, { color: colors.brand.text.body, fontFamily: inputFontFamily, textAlign: isRTL ? 'right' : 'left' }]}
                            textAlignVertical="top"
                        />
                        <View style={styles.otherMeta}>
                            <Text variant="caption" style={{ flex: 1, color: colors.brand.text.subtitle }}>
                                {t('delete_reason_other_hint', 'Your feedback helps us improve.')}
                            </Text>
                            <Text variant="caption" style={{ color: colors.brand.text.muted }}>{otherText.length}/250</Text>
                        </View>
                    </View>
                ) : null}

                <GradientButton
                    title={t('delete_account', 'Delete account')}
                    onPress={submitReason}
                    widthMode="full"
                    containerStyle={{ marginTop: scale(18) }}
                />
            </ScrollView>

            <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => !deleting && setConfirmOpen(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}>
                        <View style={styles.modalHeader}>
                            <View style={[styles.modalIcon, { backgroundColor: colors.chrome.common.dangerTint }]}>
                                <Trash2 size={scale(20)} color={colors.brand.accent.error} />
                            </View>
                            <Pressable disabled={deleting} onPress={() => setConfirmOpen(false)} style={styles.modalClose} hitSlop={8}>
                                <X size={scale(18)} color={colors.brand.text.subtitle} />
                            </Pressable>
                        </View>
                        <Text variant="h3" style={{ marginTop: scale(12) }}>
                            {t('delete_account_confirm_title', 'Delete your account?')}
                        </Text>
                        <Text variant="body-sm" style={{ marginTop: scale(8), color: colors.brand.text.subtitle }}>
                            {t('delete_account_confirm_text', 'This permanently deletes your profile, matches and messages. This cannot be undone.')}
                        </Text>
                        <Text variant="caption" className="font-body-bold" style={{ marginTop: scale(14), color: colors.chrome.common.textStrong }}>
                            {t('delete_account_type_label', 'Type to confirm:')} DELETE
                        </Text>
                        <TextInput
                            value={confirmText}
                            onChangeText={(value) => setConfirmText(value.toUpperCase())}
                            autoCapitalize="characters"
                            placeholder={t('delete_account_type_placeholder', 'Type DELETE')}
                            placeholderTextColor={colors.brand.text.muted}
                            style={[styles.confirmInput, { color: colors.brand.text.body, borderColor: colors.brand.bg.border, backgroundColor: colors.brand.bg.surface, fontFamily: inputFontFamily }]}
                        />
                        <View style={styles.modalActions}>
                            <Pressable
                                disabled={deleting}
                                onPress={() => setConfirmOpen(false)}
                                style={[styles.modalButton, { backgroundColor: colors.brand.bg.surface }]}
                            >
                                <Text variant="body-sm" className="font-body-bold">{t('cancel', 'Cancel')}</Text>
                            </Pressable>
                            <Pressable
                                disabled={confirmText !== 'DELETE' || deleting}
                                onPress={deleteAccount}
                                style={[
                                    styles.modalButton,
                                    { backgroundColor: colors.brand.accent.error, opacity: confirmText !== 'DELETE' || deleting ? 0.55 : 1 },
                                ]}
                            >
                                {deleting
                                    ? <ActivityIndicator size="small" color={colors.chrome.common.inverseText} />
                                    : (
                                        <Text variant="body-sm" className="font-body-bold" style={{ color: colors.chrome.common.inverseText }}>
                                            {t('delete_account_confirm_ok', 'Delete forever')}
                                        </Text>
                                    )}
                            </Pressable>
                        </View>
                        <Text variant="caption" style={{ marginTop: scale(10), color: colors.brand.text.muted }}>
                            {t('delete_account_confirm_hint', 'You will be logged out on all devices.')}
                        </Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    reasonsCard: { borderRadius: scale(14), borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    reasonRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12), minHeight: scale(52), paddingHorizontal: scale(14), paddingVertical: scale(10) },
    radio: { width: scale(20), height: scale(20), borderRadius: scale(10), borderWidth: 2 },
    otherBox: { marginTop: scale(12), borderRadius: scale(14), borderWidth: StyleSheet.hairlineWidth, padding: scale(12) },
    otherInput: { minHeight: scale(96), fontSize: scale(14), lineHeight: scale(19), padding: 0 },
    otherMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(10), marginTop: scale(8) },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: scale(18) },
    modalCard: { width: '100%', maxWidth: scale(420), borderRadius: scale(18), borderWidth: StyleSheet.hairlineWidth, padding: scale(18) },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalIcon: { width: scale(42), height: scale(42), borderRadius: scale(13), alignItems: 'center', justifyContent: 'center' },
    modalClose: { width: scale(34), height: scale(34), borderRadius: scale(17), alignItems: 'center', justifyContent: 'center' },
    confirmInput: { marginTop: scale(8), minHeight: scale(46), borderRadius: scale(11), borderWidth: 1, paddingHorizontal: scale(12), fontSize: scale(15), letterSpacing: 2 },
    modalActions: { flexDirection: 'row', gap: scale(10), marginTop: scale(14) },
    modalButton: { flex: 1, minHeight: scale(46), borderRadius: scale(12), alignItems: 'center', justifyContent: 'center' },
});
