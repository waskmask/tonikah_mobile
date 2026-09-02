import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, {
    BottomSheetBackdrop,
    type BottomSheetBackdropProps,
    BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import type { MembershipHistoryItem } from '@/lib/membershipService';
import { t } from '@/lib/profileDisplay';

type Props = {
    visible: boolean;
    items: MembershipHistoryItem[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    error: string;
    onClose: () => void;
    onRetry: () => void;
    onLoadMore: () => void;
};

function formatAmount(item: MembershipHistoryItem, locale: string) {
    if (!item.currency) return t('free', 'Free');
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: item.currency,
        }).format(Number(item.finalAmountMinor || 0) / 100);
    } catch {
        return `${(Number(item.finalAmountMinor || 0) / 100).toFixed(2)} ${item.currency}`;
    }
}

function formatDate(value: string | null | undefined, locale: string) {
    if (!value) return t('not_set', 'Not set');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('not_set', 'Not set');
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

function providerLabel(provider?: string) {
    const normalized = String(provider || '').toLowerCase();
    const keys: Record<string, string> = {
        stripe: 'provider_stripe',
        razorpay: 'provider_razorpay',
        giftcard: 'provider_giftcard',
        gift_card: 'provider_giftcard',
        trial: 'provider_trial',
        admin_grant: 'provider_admin_grant',
        apple_iap: 'provider_app_store',
        google_play: 'provider_google_play',
    };
    return t(keys[normalized] || 'payment', provider || t('memberships', 'Membership'));
}

export function MembershipHistorySheet({
    visible,
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    onClose,
    onRetry,
    onLoadMore,
}: Props) {
    const colors = useColors();
    const { currentLanguage, isRTL } = useLanguage();
    const insets = useSafeAreaInsets();
    const BackIcon = isRTL ? ChevronRight : ChevronLeft;
    const snapPoints = useMemo(() => ['92%'], []);
    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={0.42}
                pressBehavior='close'
            />
        ),
        [],
    );

    return (
        <Modal
            visible={visible}
            transparent
            animationType='none'
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={styles.fill}>
                <BottomSheet
                    index={0}
                    snapPoints={snapPoints}
                    enableDynamicSizing={false}
                    enablePanDownToClose
                    onClose={onClose}
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ backgroundColor: colors.brand.bg.surface }}
                    handleIndicatorStyle={{ backgroundColor: colors.brand.text.muted }}
                >
                    <View style={[styles.header, { borderBottomColor: colors.brand.bg.border }]}>
                        <Pressable
                            onPress={onClose}
                            hitSlop={10}
                            accessibilityRole='button'
                            accessibilityLabel={t('close', 'Close')}
                            style={[styles.iconButton, { backgroundColor: colors.chrome.header.iconBackground }]}
                        >
                            <BackIcon size={scale(23)} color={colors.chrome.header.icon} />
                        </Pressable>
                        <Text variant='body' className='font-body-bold' style={styles.title} numberOfLines={1}>
                            {t('membership_history', 'Membership history')}
                        </Text>
                        <View style={styles.iconButton} />
                    </View>

                    <BottomSheetFlatList
                        data={items}
                        keyExtractor={(item, index) => item.id || `${item.purchasedAt}-${index}`}
                        contentContainerStyle={[
                            styles.list,
                            { paddingBottom: insets.bottom + scale(28) },
                            !items.length && styles.emptyList,
                        ]}
                        onEndReached={() => {
                            if (hasMore && !loadingMore) onLoadMore();
                        }}
                        onEndReachedThreshold={0.35}
                        renderItem={({ item }) => (
                            <View
                                style={[
                                    styles.historyItem,
                                    {
                                        backgroundColor: colors.chrome.common.card,
                                        borderColor: colors.brand.bg.border,
                                    },
                                ]}
                            >
                                <View style={[styles.itemTop, { flexDirection: 'row' }]}>
                                    <View style={styles.itemCopy}>
                                        <Text variant='body' className='font-body-semi' numberOfLines={2}>
                                            {item.planName || t('memberships', 'Membership')}
                                        </Text>
                                        <Text variant='caption' style={{ color: colors.brand.text.subtitle }}>
                                            {providerLabel(item.provider)}
                                        </Text>
                                    </View>
                                    <View style={[styles.amountPill, { backgroundColor: colors.brand.bg.surface }]}>
                                        <Text variant='body-sm' className='font-body-bold'>
                                            {formatAmount(item, currentLanguage)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.details}>
                                    <View style={styles.detailRow}>
                                        <Clock3 size={scale(15)} color={colors.brand.text.muted} />
                                        <Text variant='caption' style={{ color: colors.brand.text.subtitle }}>
                                            {item.durationDays || 0} {t('days', 'days')}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <CalendarDays size={scale(15)} color={colors.brand.text.muted} />
                                        <Text variant='caption' style={{ color: colors.brand.text.subtitle }}>
                                            {formatDate(item.purchasedAt, currentLanguage)}
                                        </Text>
                                    </View>
                                    {item.periodEnd ? (
                                        <Text variant='caption' style={{ color: colors.brand.text.subtitle }}>
                                            {t('membership_ends', 'Ends')}: {formatDate(item.periodEnd, currentLanguage)}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        )}
                        ListHeaderComponent={(
                            <View style={styles.intro}>
                                <Text variant='body-sm' style={{ color: colors.brand.text.subtitle }}>
                                    {t('membership_history_description', 'Your membership purchases and rewards.')}
                                </Text>
                            </View>
                        )}
                        ListEmptyComponent={loading ? (
                            <ActivityIndicator color={colors.chrome.primary} />
                        ) : error ? (
                            <View style={styles.emptyState}>
                                <Text variant='body-sm' className='font-body-semi' align='center'>
                                    {error}
                                </Text>
                                <PressableScale
                                    onPress={onRetry}
                                    accessibilityRole='button'
                                    style={[styles.retry, { backgroundColor: colors.chrome.common.primaryTint }]}
                                >
                                    <Text variant='body-sm' className='font-body-semi' style={{ color: colors.chrome.primary }}>
                                        {t('btn_try_again', 'Try Again')}
                                    </Text>
                                </PressableScale>
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text variant='body' className='font-body-semi' align='center'>
                                    {t('no_membership_history', 'No membership history yet')}
                                </Text>
                                <Text variant='body-sm' align='center' style={{ color: colors.brand.text.subtitle }}>
                                    {t('no_membership_history_description', 'Purchases, gift cards, trials, and admin grants will appear here.')}
                                </Text>
                            </View>
                        )}
                        ListFooterComponent={loadingMore ? (
                            <ActivityIndicator style={styles.footerLoader} color={colors.chrome.primary} />
                        ) : null}
                    />
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1 },
    header: {
        minHeight: scale(54),
        borderBottomWidth: StyleSheet.hairlineWidth,
        // 6.5 + 7.5 (chevron inset inside its 38pt button) = 14dp edge→icon
        paddingHorizontal: scale(6.5),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconButton: {
        width: scale(38),
        height: scale(38),
        borderRadius: scale(19),
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: { flex: 1, textAlign: 'center', fontSize: scale(16) },
    list: { paddingHorizontal: scale(16), paddingTop: scale(12), gap: scale(12) },
    emptyList: { flexGrow: 1 },
    intro: { paddingBottom: scale(4) },
    historyItem: { borderWidth: 1, borderRadius: scale(8), padding: scale(14), gap: scale(12) },
    itemTop: { alignItems: 'flex-start', gap: scale(12) },
    itemCopy: { flex: 1, minWidth: 0, gap: scale(3) },
    amountPill: { borderRadius: scale(8), paddingHorizontal: scale(10), paddingVertical: scale(6) },
    details: { gap: scale(7) },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: scale(7) },
    emptyState: { flex: 1, minHeight: scale(240), justifyContent: 'center', alignItems: 'center', gap: scale(10) },
    retry: { minHeight: scale(40), borderRadius: scale(8), paddingHorizontal: scale(16), justifyContent: 'center' },
    footerLoader: { marginVertical: scale(18) },
});
