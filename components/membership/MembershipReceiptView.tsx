import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { DownloadSimple, ArrowSquareOut } from 'phosphor-react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { api } from '@/lib/api';
import { membershipService, type MembershipHistoryItem, type MembershipReceipt } from '@/lib/membershipService';
import { receiptFileName, receiptPurchaseId, receiptSupportUrl } from '@/lib/membershipReceipt';
import { t } from '@/lib/profileDisplay';

export function MembershipReceiptView({ item, bottomInset }: { item: MembershipHistoryItem; bottomInset: number }) {
    const colors = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const [receipt, setReceipt] = useState<MembershipReceipt | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [sharing, setSharing] = useState(false);
    const busy = useRef(false);
    const mounted = useRef(true);
    const storePurchase = ['apple_iap', 'apple', 'google_play'].includes(item.provider || '');

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        setReceipt(null);
        const load = async () => {
            try {
                const id = receiptPurchaseId(item.id);
                if (!id) {
                    if (!cancelled) setError('membership_receipt_unavailable');
                    return;
                }
                const response = await membershipService.receipt(id);
                if (cancelled) return;
                if (response.document && response.status === 200) setReceipt(response.document);
                else setError(response.status === 404 ? 'membership_receipt_unavailable' : 'membership_receipt_error');
            } catch {
                if (!cancelled) setError('membership_receipt_error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [item.id, attempt]);

    async function saveReceipt() {
        if (!receipt?.downloadReady || busy.current) return;
        busy.current = true;
        setSharing(true);
        setError('');
        let file: File | undefined;
        let shared = false;
        try {
            // Lazy import keeps older development builds usable without ExpoSharing.
            const Sharing = await import('expo-sharing');
            if (!await Sharing.isAvailableAsync()) throw new Error('sharing_unavailable');
            const bytes = await api.getPdf(`/membership/invoices/${encodeURIComponent(receipt.id)}/download`);
            if (!mounted.current) return;
            const directory = new Directory(Paths.cache, 'membership-receipts');
            directory.create({ idempotent: true });
            // A receiving Android app can read after the chooser closes. Remove
            // old temporary PDFs on the next download, not immediately on sharing.
            for (const entry of directory.list()) {
                if (entry instanceof File && entry.modificationTime && Date.now() - entry.modificationTime > 86400000) entry.delete();
            }
            file = new File(directory, `${Date.now()}-${receiptFileName(receipt.documentNumber)}`);
            file.write(bytes);
            await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('membership_receipt_save', 'Save or share PDF') });
            shared = true;
        } catch {
            if (mounted.current) setError('membership_receipt_download_error');
        } finally {
            try { if (!shared && file?.exists) file.delete(); } catch { /* OS cache cleanup remains available. */ }
            busy.current = false;
            if (mounted.current) setSharing(false);
        }
    }

    const row = { flexDirection: isRTL ? 'row-reverse' as const : 'row' as const };
    return <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + scale(24) }]}>
        {loading ? <ActivityIndicator color={colors.chrome.primary} /> : <>
            <Text variant="body" className="font-body-bold">{item.planName || t('memberships', 'Membership')}</Text>
            {receipt && <>
                <Text variant="body-sm">{receipt.seller?.legalName}</Text>
                <Text variant="body-sm" selectable>{receipt.documentNumber}</Text>
                <Text variant="caption" style={{ color: colors.brand.text.subtitle }}>
                    {Number.isNaN(Date.parse(receipt.issuedAt)) ? '' : new Intl.DateTimeFormat(currentLanguage, { dateStyle: 'medium' }).format(new Date(receipt.issuedAt))}
                </Text>
                {receipt.lineItems?.map((line, index) => <Text key={index} variant="body-sm">{line.description}</Text>)}
                <Text variant="body" className="font-body-bold">
                    {formatReceiptAmount(receipt, currentLanguage)}
                </Text>
                {receipt.downloadReady ? <Pressable onPress={() => void saveReceipt()} disabled={sharing} accessibilityRole="button" accessibilityState={{ busy: sharing, disabled: sharing }} style={[styles.action, row, { backgroundColor: colors.chrome.common.primaryTint }]}>
                    {sharing ? <ActivityIndicator color={colors.chrome.primary} /> : <DownloadSimple size={scale(20)} color={colors.chrome.primary} />}
                    <Text variant="body-sm" className="font-body-semi" style={styles.actionText}>{t('membership_receipt_save', 'Save or share PDF')}</Text>
                </Pressable> : <>
                    <Text variant="body-sm">{t('membership_receipt_pending', 'The PDF is being prepared. Please try again later.')}</Text>
                    <Pressable onPress={() => setAttempt(a => a + 1)} accessibilityRole="button" style={styles.action}>
                        <Text variant="body-sm">{t('btn_try_again', 'Try Again')}</Text>
                    </Pressable>
                </>}
            </>}
            {!!error && <View style={styles.error}>
                <Text variant="body-sm" accessibilityRole="alert">{t(error, 'Unable to load the receipt. Please try again.')}</Text>
                {!receipt && <Pressable onPress={() => setAttempt(a => a + 1)} accessibilityRole="button" style={styles.action}>
                    <Text variant="body-sm" style={{ color: colors.chrome.primary }}>{t('btn_try_again', 'Try Again')}</Text>
                </Pressable>}
            </View>}
            {(storePurchase || (!receipt && !loading)) && <>
                <Text variant="body-sm" style={{ color: colors.brand.text.subtitle }}>
                    {storePurchase ? t('membership_receipt_store_help', 'For store-issued receipts, check your Apple or Google Play purchase history.') : t('membership_receipt_web_help', 'You can also check receipts by signing in at tonikah.com.')}
                </Text>
                <Pressable accessibilityRole="link" style={[styles.action, row]} onPress={() => {
                    void Linking.openURL(receiptSupportUrl(item.provider)).catch(() => setError('membership_receipt_error'));
                }}>
                    <ArrowSquareOut size={scale(20)} color={colors.chrome.primary} />
                    <Text variant="body-sm" style={[styles.actionText, { color: colors.chrome.primary }]}>
                        {storePurchase ? t('membership_receipt_store', 'Store receipt help') : t('membership_receipt_web', 'Open Tonikah website')}
                    </Text>
                </Pressable>
            </>}
        </>}
    </BottomSheetScrollView>;
}

function formatReceiptAmount(receipt: MembershipReceipt, locale: string) {
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: receipt.currency }).format(receipt.grossAmountMinor / 100);
    } catch {
        return `${(receipt.grossAmountMinor / 100).toFixed(2)} ${receipt.currency || ''}`;
    }
}

const styles = StyleSheet.create({
    content: { padding: scale(16), gap: scale(14) },
    action: { minHeight: scale(44), padding: scale(10), borderRadius: scale(8), alignItems: 'center', justifyContent: 'center', gap: scale(8) },
    actionText: { flexShrink: 1 },
    error: { gap: scale(8) },
});
