import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CaretDown, CaretUp, X } from 'phosphor-react-native';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { membershipService } from '@/lib/membershipService';
import { t } from '@/lib/profileDisplay';

export type AppliedMembershipCoupon = { planSlug: string; code: string; currency: string; finalAmountMinor: number; discountMinor: number };

export function MembershipCouponInput({ planSlug, currency, applied, onApply, onBusy }: {
    planSlug: string;
    currency: string;
    applied: AppliedMembershipCoupon | null;
    onApply: (coupon: AppliedMembershipCoupon | null) => void;
    onBusy: (busy: boolean) => void;
}) {
    const colors = useColors();
    const { isRTL, currentLanguage } = useLanguage();
    const [expanded, setExpanded] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const request = useRef(0);
    const inFlight = useRef(false);
    useEffect(() => () => { request.current++; onBusy(false); }, [onBusy]);

    async function apply() {
        if (!code.trim() || inFlight.current) return;
        inFlight.current = true;
        const version = ++request.current;
        setBusy(true);
        onBusy(true);
        setError(false);
        try {
            const response = await membershipService.validateCoupon(planSlug, code.trim().toUpperCase());
            if (request.current !== version) return;
            const summary = response.summary;
            if (!response.valid || !response.coupon?.code || summary?.currency !== currency
                || !Number.isFinite(summary.finalAmountMinor) || summary.finalAmountMinor < 0
                || !Number.isFinite(summary.discountMinor) || summary.discountMinor <= 0) throw new Error('invalid_coupon');
            onApply({ planSlug, code: response.coupon.code, currency: summary.currency, finalAmountMinor: summary.finalAmountMinor, discountMinor: summary.discountMinor });
        } catch {
            if (request.current === version) setError(true);
        } finally {
            if (request.current === version) { inFlight.current = false; setBusy(false); onBusy(false); }
        }
    }

    const row = { flexDirection: isRTL ? 'row-reverse' as const : 'row' as const };
    const Chevron = expanded ? CaretUp : CaretDown;
    return <View style={styles.container}>
        <Pressable onPress={() => setExpanded(v => !v)} accessibilityRole="button" accessibilityState={{ expanded }} style={[styles.toggle, row]}>
            <Text variant="body-sm" className="font-body-semi">{t('membership_coupon_toggle', 'Have a coupon?')}</Text>
            <Chevron size={scale(18)} color={colors.brand.text.subtitle} />
        </Pressable>
        {(expanded || applied) && <>
            {applied ? <View style={[styles.row, row]}>
                <Text variant="body-sm" style={styles.copy}>
                    {applied.code} {'\u00b7'} -{new Intl.NumberFormat(currentLanguage, { style: 'currency', currency }).format(applied.discountMinor / 100)}
                </Text>
                <Pressable onPress={() => { onApply(null); setError(false); }} accessibilityRole="button" accessibilityLabel={t('remove', 'Remove')} style={styles.icon}>
                    <X size={scale(20)} color={colors.brand.text.subtitle} />
                </Pressable>
            </View> : <View style={[styles.row, row]}>
                <TextInput value={code} onChangeText={value => { setCode(value); setError(false); }} editable={!busy}
                    maxLength={32} autoCapitalize="characters" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => void apply()}
                    placeholder={t('membership_coupon_code', 'Coupon code')} accessibilityLabel={t('membership_coupon_code', 'Coupon code')}
                    placeholderTextColor={colors.brand.text.muted}
                    style={[styles.input, { color: colors.brand.text.body, borderColor: colors.brand.bg.border, backgroundColor: colors.brand.bg.surface, textAlign: isRTL ? 'right' : 'left' }]} />
                <Pressable onPress={() => void apply()} disabled={busy || !code.trim()} accessibilityRole="button" accessibilityState={{ disabled: busy || !code.trim(), busy }}
                    style={[styles.apply, { backgroundColor: colors.chrome.common.primaryTint }]}>
                    {busy ? <ActivityIndicator color={colors.chrome.primary} /> : <Text variant="body-sm" style={{ color: colors.chrome.primary }}>{t('membership_coupon_apply', 'Apply')}</Text>}
                </Pressable>
            </View>}
            <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>{t('membership_coupon_web_only', 'Coupons apply to web checkout only.')}</Text>
            {error && <Text variant="body-sm" accessibilityRole="alert">{t('membership_coupon_error', 'Could not apply this coupon. Check the code and your connection, then try again.')}</Text>}
        </>}
    </View>;
}

const styles = StyleSheet.create({
    container: { gap: scale(8) },
    toggle: { minHeight: scale(44), alignItems: 'center', justifyContent: 'center', gap: scale(6) },
    row: { alignItems: 'center', gap: scale(8) },
    copy: { flex: 1 },
    input: { flex: 1, minWidth: 0, minHeight: scale(44), borderWidth: 1, borderRadius: scale(8), padding: scale(10), fontSize: scale(14) },
    apply: { minHeight: scale(44), paddingHorizontal: scale(16), justifyContent: 'center', borderRadius: scale(8) },
    icon: { width: scale(44), height: scale(44), justifyContent: 'center', alignItems: 'center' },
});
