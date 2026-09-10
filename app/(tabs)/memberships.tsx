import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CalendarDays, Check, Clock3, CreditCard, Gift, History, RefreshCw, ShieldCheck, ShoppingBag } from 'lucide-react-native';

import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import {
    MembershipPaymentSheet,
    type MembershipPaymentChoice,
} from '@/components/membership/MembershipPaymentSheet';
import { GiftCardRedemptionSheet } from '@/components/membership/GiftCardRedemptionSheet';
import { MembershipHistorySheet } from '@/components/membership/MembershipHistorySheet';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { GradientButton } from '@/components/ui/GradientButton';
import { Config } from '@/constants/config';
import { useColors } from '@/hooks/useColors';
import { useEmailVerificationGuard } from '@/hooks/useEmailVerificationGuard';
import { useLanguage } from '@/hooks/useLanguage';
import { scale } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import i18n from '@/lib/i18n';
import {
    membershipService,
    type MembershipOverview,
    type MembershipHistoryItem,
    type MembershipPlan,
    type MobilePurchasePolicy,
} from '@/lib/membershipService';
import {
    closeNativeMembershipStore,
    fetchNativeMembershipProducts,
    getNativeStorefrontCountryCode,
    isPurchaseCancelled,
    nativeProductConfig,
    purchaseNativeMembership,
    recoverPendingNativeMembershipPurchase,
    type NativeStoreProduct,
} from '@/lib/nativeMembershipPurchase';
import { apiMessage, t } from '@/lib/profileDisplay';
import { queryClient } from '@/lib/queryClient';
import { CURRENT_USER_STATUS_QUERY_KEY, type CurrentUserStatus } from '@/hooks/useCurrentUserStatus';
import { withMessagingAccessClock } from '@/lib/messagingAccess';

type CheckoutState = 'idle' | 'creating' | 'browser_open' | 'refreshing' | 'pending';

const EMPTY_OVERVIEW: MembershipOverview = {
    membership: null,
    isActive: false,
    daysLeft: 0,
    trial: { used: false, active: false, daysLeft: 0 },
    historyCount: 0,
};

function overviewFromResponse(response: any): MembershipOverview {
    if (!response?.success && !response?.ok) {
        throw new Error(response?.message || 'membership_refresh_failed');
    }
    const source = response?.data || response;
    const membership = Object.prototype.hasOwnProperty.call(source, 'membership')
        ? source.membership || null
        : null;
    return {
        membership,
        isActive: Boolean(
            source?.isActive
            || (
                membership?.status === 'active'
                && membership?.currentPeriodEnd
                && new Date(membership.currentPeriodEnd).getTime() > Date.now()
            ),
        ),
        daysLeft: Math.max(0, Number(source?.daysLeft || 0)),
        trial: {
            used: Boolean(source?.trial?.used),
            active: Boolean(source?.trial?.active),
            daysLeft: Math.max(0, Number(source?.trial?.daysLeft || 0)),
        },
        historyCount: Math.max(0, Number(source?.historyCount || 0)),
        messagingAccess: source?.messagingAccess
            ? withMessagingAccessClock(source.messagingAccess)
            : undefined,
        trialOffer: source?.trialOffer,
    };
}

function membershipSignature(overview: MembershipOverview) {
    const membership = overview.membership;
    return JSON.stringify({
        active: overview.isActive,
        status: membership?.status || null,
        provider: membership?.provider || null,
        expiresAt: membership?.currentPeriodEnd || null,
        updatedAt: membership?.updatedAt || null,
    });
}

function isTrustedCheckoutUrl(value: string) {
    try {
        const checkoutUrl = new URL(value);
        const configuredOrigin = new URL(Config.WEB_APP_ORIGIN).origin;
        return checkoutUrl.protocol === 'https:' && checkoutUrl.origin === configuredOrigin;
    } catch {
        return false;
    }
}

function isTrialPlan(plan: MembershipPlan) {
    return plan.kind === 'trial' || plan.slug.toLowerCase().includes('trial');
}

function translatedPlanName(plan?: MembershipPlan | null) {
    if (!plan) return '';
    return t(`membership_plans.${plan.slug}.title`, plan.displayName || plan.slug);
}

function translatedPlanFeatures(plan: MembershipPlan) {
    const translated = i18n.t(`membership_plans.${plan.slug}.features`, {
        defaultValue: plan.features,
        returnObjects: true,
    });
    return Array.isArray(translated) ? translated.map(String) : plan.features;
}

function giftCardErrorMessage(message?: string) {
    const normalized = String(message || '').trim().toUpperCase();
    const keys: Record<string, string> = {
        INVALID_GIFT_CARD: 'error_gift_invalid',
        INVALID_CODE: 'error_gift_invalid',
        ALREADY_REDEEMED: 'error_gift_used',
        EXPIRED: 'error_gift_expired',
        NOT_STARTED: 'error_gift_not_started',
        PLAN_INACTIVE: 'error_gift_plan_inactive',
        GIFT_CARD_TEMPORARILY_UNAVAILABLE: 'error_gift_redeem_failed',
    };
    if (normalized.includes('TOO MANY')) {
        return t('error_too_many_attempts', 'Too many attempts. Please try again later.');
    }
    return t(keys[normalized] || 'error_gift_redeem_failed', 'Could not redeem the gift card. Please try again.');
}

export default function MembershipsScreen() {
    const colors = useColors();
    const { currentLanguage } = useLanguage();
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();
    const [plans, setPlans] = useState<MembershipPlan[]>([]);
    const [overview, setOverview] = useState<MembershipOverview>(EMPTY_OVERVIEW);
    const [mobilePurchase, setMobilePurchase] = useState<MobilePurchasePolicy | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [startingPlan, setStartingPlan] = useState<string | null>(null);
    const [openingPlan, setOpeningPlan] = useState<string | null>(null);
    const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
    const [paymentPlan, setPaymentPlan] = useState<MembershipPlan | null>(null);
    const [busyPaymentChoice, setBusyPaymentChoice] = useState<MembershipPaymentChoice['kind'] | null>(null);
    const [nativeProducts, setNativeProducts] = useState<Record<string, NativeStoreProduct>>({});
    const [nativeCatalogLoading, setNativeCatalogLoading] = useState(false);
    const [nativeCatalogError, setNativeCatalogError] = useState(false);
    const [storefrontCountryCode, setStorefrontCountryCode] = useState('');
    const [giftCardOpen, setGiftCardOpen] = useState(false);
    const [giftCardBusy, setGiftCardBusy] = useState(false);
    const [giftCardError, setGiftCardError] = useState('');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyItems, setHistoryItems] = useState<MembershipHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [historyCursor, setHistoryCursor] = useState('');
    const [historyHasMore, setHistoryHasMore] = useState(false);
    const refreshInFlightRef = useRef<Promise<MembershipOverview> | null>(null);
    const nativeRecoveryInFlightRef = useRef<Promise<void> | null>(null);
    const recoveryAttemptedRef = useRef(false);

    const paidPlans = useMemo(() => plans.filter((plan) => !isTrialPlan(plan)), [plans]);
    const trialPlan = useMemo(
        () => plans.find(isTrialPlan) || null,
        [plans],
    );

    const refreshMembership = useCallback(async () => {
        if (refreshInFlightRef.current) return refreshInFlightRef.current;
        const request = membershipService.me()
            .then(overviewFromResponse)
            .then((nextOverview) => {
                setOverview(nextOverview);
                queryClient.setQueryData<CurrentUserStatus>(CURRENT_USER_STATUS_QUERY_KEY, (current) => ({
                    ...(current || {}),
                    messagingAccess: nextOverview.messagingAccess,
                    trialOffer: nextOverview.trialOffer,
                }));
                return nextOverview;
            })
            .finally(() => {
                refreshInFlightRef.current = null;
            });
        refreshInFlightRef.current = request;
        return request;
    }, []);

    const recoverNativePurchase = useCallback(async () => {
        if (Platform.OS === 'web') return;
        if (nativeRecoveryInFlightRef.current) return nativeRecoveryInFlightRef.current;
        const request = recoverPendingNativeMembershipPurchase()
            .then(async (result) => {
                if (!result) return;
                if (result.pending) {
                    setCheckoutState('pending');
                    return;
                }
                await refreshMembership();
                setCheckoutState('idle');
                toast.show(t('membership_purchase_success', 'Your membership is active.'), 'success', 3500);
            })
            .catch(() => undefined)
            .finally(() => {
                nativeRecoveryInFlightRef.current = null;
            });
        nativeRecoveryInFlightRef.current = request;
        return request;
    }, [refreshMembership, toast]);

    const loadScreen = useCallback(async () => {
        setLoadError(false);
        try {
            const storefront = Platform.OS === 'web'
                ? ''
                : await getNativeStorefrontCountryCode().catch(() => '');
            const [nextOverview, planResponse] = await Promise.all([
                refreshMembership(),
                membershipService.plans(storefront),
            ]);
            if (!planResponse?.success && !planResponse?.ok) {
                throw new Error(planResponse?.message || 'membership_plans_failed');
            }
            setOverview(nextOverview);
            setStorefrontCountryCode(storefront);
            setPlans(planResponse.plans || planResponse.data?.plans || []);
            setMobilePurchase(
                planResponse.mobilePurchase
                || planResponse.data?.mobilePurchase
                || null,
            );
        } catch {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [refreshMembership]);

    useEffect(() => {
        void loadScreen();
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                void Promise.allSettled([
                    refreshMembership(),
                    recoverNativePurchase(),
                ]);
            }
        });
        return () => {
            subscription.remove();
            void closeNativeMembershipStore().catch(() => undefined);
        };
    }, [loadScreen, recoverNativePurchase, refreshMembership]);

    useEffect(() => {
        if (loading || recoveryAttemptedRef.current || Platform.OS === 'web') return;
        recoveryAttemptedRef.current = true;
        void recoverNativePurchase();
    }, [loading, recoverNativePurchase]);

    useEffect(() => {
        const expectedKind = Platform.OS === 'ios' ? 'apple_iap' : 'google_play';
        const nativeOption = mobilePurchase?.options?.find(
            (option) => option.kind === expectedKind && option.enabled,
        );
        if (!nativeOption) {
            setNativeProducts({});
            setNativeCatalogLoading(false);
            setNativeCatalogError(false);
            return;
        }
        let cancelled = false;
        const planConfigs = paidPlans
            .map((plan) => {
                const config = nativeProductConfig(nativeOption, plan.slug);
                return config ? { planSlug: plan.slug, config } : null;
            })
            .filter(Boolean) as { planSlug: string; config: NonNullable<ReturnType<typeof nativeProductConfig>> }[];
        setNativeCatalogLoading(true);
        setNativeCatalogError(false);
        void fetchNativeMembershipProducts(planConfigs.map(({ config }) => config))
            .then((products) => {
                if (cancelled) return;
                setNativeProducts(Object.fromEntries(
                    planConfigs
                        .map(({ planSlug, config }) => {
                            const product = products[config.productId];
                            return product ? [planSlug, product] as const : null;
                        })
                        .filter(Boolean) as [string, NativeStoreProduct][],
                ));
                setNativeCatalogError(planConfigs.length > 0 && Object.keys(products).length === 0);
            })
            .catch(() => {
                if (!cancelled) {
                    setNativeProducts({});
                    setNativeCatalogError(true);
                }
            })
            .finally(() => {
                if (!cancelled) setNativeCatalogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [mobilePurchase, paidPlans]);

    const loadHistory = useCallback(async (cursor = '', append = false) => {
        if (append) setHistoryLoadingMore(true);
        else setHistoryLoading(true);
        setHistoryError('');
        try {
            const response = await membershipService.history(cursor, 10);
            if (response.status && response.status >= 400) {
                throw new Error(response.message || 'history_load_failed');
            }
            const nextItems = Array.isArray(response.history) ? response.history : [];
            setHistoryItems((current) => append ? [...current, ...nextItems] : nextItems);
            setHistoryHasMore(Boolean(response.pageInfo?.hasMore));
            setHistoryCursor(response.pageInfo?.nextCursor || '');
        } catch {
            setHistoryError(t('history_load_failed', 'Could not load membership history.'));
        } finally {
            setHistoryLoading(false);
            setHistoryLoadingMore(false);
        }
    }, []);

    const openHistory = () => {
        setGiftCardOpen(false);
        setHistoryOpen(true);
        if (!historyItems.length && !historyLoading) void loadHistory();
    };

    const redeemGiftCard = async (code: string, pin: string) => {
        setGiftCardError('');
        if (!/^[A-Z0-9]{8}$/.test(code.replace(/^TGC-/, ''))) {
            setGiftCardError(t('gift_code_invalid_length', 'Enter the 8-character gift card code.'));
            return;
        }
        if (!/^\d{4}$/.test(pin)) {
            setGiftCardError(t('gift_pin_invalid_length', 'Enter the 4-digit gift card PIN.'));
            return;
        }
        setGiftCardBusy(true);
        try {
            const response = await membershipService.redeemGiftCard(code, pin);
            if (!response.success) {
                setGiftCardError(giftCardErrorMessage(response.message));
                return;
            }
            setGiftCardOpen(false);
            setHistoryItems([]);
            setHistoryCursor('');
            await refreshMembership();
            if (response.status === 202 || response.message === 'gift_card_redemption_processing') {
                setCheckoutState('pending');
                toast.show(t('gift_card_processing', 'Gift card accepted. Membership activation is processing.'), 'info', 4500);
            } else {
                toast.show(t('gift_redeemed_success', 'Gift card redeemed. Your membership is active.'), 'success', 3500);
            }
        } catch {
            setGiftCardError(t('error_gift_redeem_failed', 'Could not redeem the gift card. Please try again.'));
        } finally {
            setGiftCardBusy(false);
        }
    };

    const startTrial = async (plan: MembershipPlan) => {
        if (!requireVerified('checkout')) return;
        setStartingPlan(plan.slug);
        try {
            const response = await membershipService.startTrial(plan.slug || plan.id);
            if (!response.success && !response.ok) {
                Alert.alert(t('error', 'Error'), apiMessage(response.message));
                return;
            }
            const messagingAccess = response.messagingAccess;
            if (messagingAccess) {
                queryClient.setQueryData<CurrentUserStatus>(CURRENT_USER_STATUS_QUERY_KEY, (current) => ({
                    ...(current || {}),
                    messagingAccess: withMessagingAccessClock(messagingAccess),
                    trialOffer: response.trialOffer,
                }));
            }
            await refreshMembership();
            toast.show(apiMessage(response.message, 'profile_updated_success'), 'success', 3000);
        } catch {
            Alert.alert(t('error', 'Error'), t('network_error', 'No internet connection. Please check and try again.'));
        } finally {
            setStartingPlan(null);
        }
    };

    const openCheckout = async (plan: MembershipPlan) => {
        if (!requireVerified('checkout')) return;
        if (!plan.slug) return;
        setOpeningPlan(plan.slug);
        setCheckoutState('creating');
        const beforeCheckout = membershipSignature(overview);
        try {
            const response = await membershipService.createCheckoutHandoff(
                plan.slug,
                storefrontCountryCode,
            );
            if (!response.success || !response.handoffUrl) {
                Alert.alert(t('error', 'Error'), apiMessage(response.message));
                setCheckoutState('idle');
                return;
            }
            if (!isTrustedCheckoutUrl(response.handoffUrl)) {
                Alert.alert(
                    t('error', 'Error'),
                    t('checkout_untrusted_url', 'Secure checkout returned an invalid address.'),
                );
                setCheckoutState('idle');
                return;
            }
            setCheckoutState('browser_open');
            await WebBrowser.openBrowserAsync(response.handoffUrl, {
                showTitle: true,
                enableBarCollapsing: false,
            });
            setCheckoutState('refreshing');
            const nextOverview = await refreshMembership();
            setCheckoutState(
                membershipSignature(nextOverview) === beforeCheckout ? 'pending' : 'idle',
            );
        } catch {
            Alert.alert(
                t('error', 'Error'),
                t('checkout_open_failed', 'Could not open secure checkout. Please try again.'),
            );
            setCheckoutState('idle');
        } finally {
            setOpeningPlan(null);
        }
    };

    const refreshAfterCheckout = async () => {
        const beforeRefresh = membershipSignature(overview);
        setCheckoutState('refreshing');
        try {
            const nextOverview = await refreshMembership();
            setCheckoutState(
                membershipSignature(nextOverview) === beforeRefresh ? 'pending' : 'idle',
            );
        } catch {
            setCheckoutState('pending');
            toast.show(t('membership_refresh_failed', 'Could not refresh membership. Try again.'), 'error');
        }
    };

    const refreshScreen = async () => {
        await Promise.allSettled([
            refreshAfterCheckout(),
            loadScreen(),
        ]);
    };

    const paymentChoicesForPlan = useCallback((plan: MembershipPlan): MembershipPaymentChoice[] => {
        const expectedKind = Platform.OS === 'ios' ? 'apple_iap' : 'google_play';
        const nativeOption = mobilePurchase?.options?.find(
            (option) => option.kind === expectedKind && option.enabled,
        );
        const nativeConfig = nativeProductConfig(nativeOption, plan.slug);
        const nativeProduct = nativeProducts[plan.slug];
        const choices: MembershipPaymentChoice[] = [];

        if (nativeConfig && nativeProduct) {
            choices.push({
                kind: expectedKind,
                label: Platform.OS === 'ios'
                    ? t('pay_with_app_store', 'Pay with App Store')
                    : t('pay_with_google_play', 'Pay with Google Play'),
                description: Platform.OS === 'ios'
                    ? t('app_store_payment_description', 'Use your Apple account and App Store payment method.')
                    : t('google_play_payment_description', 'Use your Google account and Play payment method.'),
                price: nativeProduct.displayPrice,
            });
        }

        if (mobilePurchase?.externalHandoffEnabled && plan.checkoutEnabled && plan.price) {
            choices.push({
                kind: 'external_web',
                label: t('pay_with_card', 'Pay with card'),
                description: t('card_payment_description', 'Continue in your browser with secure web checkout.'),
                price: plan.price.formatted,
            });
        }
        return choices;
    }, [mobilePurchase, nativeProducts]);

    const choosePayment = async (choice: MembershipPaymentChoice) => {
        const plan = paymentPlan;
        if (!plan || !requireVerified('checkout')) return;
        if (choice.kind === 'external_web') {
            setPaymentPlan(null);
            await openCheckout(plan);
            return;
        }

        const nativeOption = mobilePurchase?.options?.find(
            (option) => option.kind === choice.kind && option.enabled,
        );
        const config = nativeProductConfig(nativeOption, plan.slug);
        if (!config) return;

        setBusyPaymentChoice(choice.kind);
        try {
            const result = await purchaseNativeMembership(plan.slug, config);
            if (result.pending) {
                setPaymentPlan(null);
                setCheckoutState('pending');
                toast.show(
                    t('payment_pending_store', 'Your store payment is pending. Membership activates after confirmation.'),
                    'info',
                    4500,
                );
                return;
            }
            await refreshMembership();
            setPaymentPlan(null);
            toast.show(t('membership_purchase_success', 'Your membership is active.'), 'success', 3500);
        } catch (error) {
            if (!isPurchaseCancelled(error)) {
                Alert.alert(
                    t('payment_not_completed', 'Payment not completed'),
                    t(
                        'native_purchase_failed',
                        'We could not confirm this purchase yet. Check your membership before trying again, or contact support.',
                    ),
                );
            }
        } finally {
            setBusyPaymentChoice(null);
        }
    };

    const endsOn = overview.membership?.currentPeriodEnd
        ? new Intl.DateTimeFormat(currentLanguage, { dateStyle: 'medium' })
            .format(new Date(overview.membership.currentPeriodEnd))
        : '';
    const activePlan = plans.find((plan) => plan.slug === overview.membership?.planSlug);

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.brand.bg.surface }]}>
                <ActivityIndicator color={colors.chrome.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title={t('memberships', 'Memberships')} />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        refreshing={checkoutState === 'refreshing'}
                        onRefresh={() => void refreshScreen()}
                        tintColor={colors.chrome.primary}
                        colors={[colors.chrome.primary]}
                    />
                )}
            >
                {loadError ? (
                    <View style={[styles.notice, { borderColor: colors.brand.bg.border }]}>
                        <Text variant='body' className='font-body-semi'>
                            {t('network_error', 'No internet connection. Please check and try again.')}
                        </Text>
                        <PressableScale
                            onPress={() => {
                                setLoading(true);
                                void loadScreen();
                            }}
                            accessibilityRole='button'
                            accessibilityLabel={t('btn_try_again', 'Try Again')}
                            style={[styles.inlineAction, { backgroundColor: colors.chrome.common.primaryTint }]}
                        >
                            <RefreshCw size={scale(16)} color={colors.chrome.primary} />
                            <Text variant='body-sm' className='font-body-semi' style={{ color: colors.chrome.primary }}>
                                {t('btn_try_again', 'Try Again')}
                            </Text>
                        </PressableScale>
                    </View>
                ) : null}

                <View
                    style={[
                        styles.statusPanel,
                        {
                            backgroundColor: overview.isActive
                                ? colors.chrome.toast.success.bg
                                : colors.chrome.common.card,
                            borderColor: overview.isActive
                                ? colors.chrome.toast.success.border
                                : colors.brand.bg.border,
                        },
                    ]}
                >
                    <View style={styles.statusHeader}>
                        <View
                            style={[
                                styles.statusIcon,
                                {
                                    backgroundColor: overview.isActive
                                        ? colors.chrome.toast.success.border
                                        : colors.chrome.common.primaryTint,
                                },
                            ]}
                        >
                            {overview.isActive
                                ? <ShieldCheck size={scale(22)} color={colors.chrome.common.inverseText} />
                                : <Clock3 size={scale(22)} color={colors.chrome.primary} />}
                        </View>
                        <View style={styles.statusCopy}>
                            <Text variant='subtitle'>{t('current_membership', 'Current membership')}</Text>
                            <Text variant='h3' style={styles.statusTitle}>
                                {overview.isActive ? t('active', 'Active') : t('membership_inactive', 'Membership inactive')}
                            </Text>
                        </View>
                    </View>
                    {overview.isActive ? (
                        <View style={styles.statusMeta}>
                            <View style={styles.metaItem}>
                                <Text variant='caption' style={{ color: colors.brand.text.subtitle }}>
                                    {activePlan ? translatedPlanName(activePlan) : overview.membership?.planName || t('memberships', 'Memberships')}
                                </Text>
                            </View>
                            <View style={styles.metaItem}>
                                <CalendarDays size={scale(15)} color={colors.chrome.toast.success.text} />
                                <Text variant='caption' className='font-body-semi' style={{ color: colors.chrome.toast.success.text }}>
                                    {endsOn || `${overview.daysLeft} ${t('days', 'days')}`}
                                </Text>
                            </View>
                        </View>
                    ) : null}
                </View>

                <View style={styles.quickActions}>
                    <PressableScale
                        onPress={() => {
                            setHistoryOpen(false);
                            setGiftCardError('');
                            setGiftCardOpen(true);
                        }}
                        accessibilityRole='button'
                        accessibilityLabel={t('redeem_gift_card', 'Redeem gift card')}
                        style={[styles.quickAction, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}
                    >
                        <Gift size={scale(17)} color={colors.chrome.primary} />
                        <Text variant='body-sm' className='font-body-semi' numberOfLines={1}>
                            {t('redeem_gift_card', 'Redeem gift card')}
                        </Text>
                    </PressableScale>
                    <PressableScale
                        onPress={openHistory}
                        accessibilityRole='button'
                        accessibilityLabel={t('membership_history', 'Membership history')}
                        style={[styles.quickAction, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}
                    >
                        <History size={scale(17)} color={colors.chrome.primary} />
                        <Text variant='body-sm' className='font-body-semi' numberOfLines={1}>
                            {t('membership_history', 'History')}
                        </Text>
                        {overview.historyCount > 0 ? (
                            <View style={[styles.countBadge, { backgroundColor: colors.chrome.common.primaryTint }]}>
                                <Text variant='caption' className='font-body-bold' style={{ color: colors.chrome.primary }}>
                                    {Math.min(overview.historyCount, 99)}{overview.historyCount > 99 ? '+' : ''}
                                </Text>
                            </View>
                        ) : null}
                    </PressableScale>
                </View>

                {checkoutState === 'pending' || checkoutState === 'refreshing' ? (
                    <View style={[styles.processingPanel, { borderColor: colors.brand.bg.border }]}>
                        <ActivityIndicator size='small' color={colors.chrome.primary} />
                        <View style={styles.processingCopy}>
                            <Text variant='body-sm' className='font-body-semi'>
                                {checkoutState === 'refreshing'
                                    ? t('refreshing_membership', 'Refreshing membership...')
                                    : t('payment_may_be_processing', 'Payment may still be processing. Refresh before starting another checkout.')}
                            </Text>
                        </View>
                        <PressableScale
                            onPress={() => void refreshAfterCheckout()}
                            disabled={checkoutState === 'refreshing'}
                            accessibilityRole='button'
                            accessibilityLabel={t('refresh_membership', 'Refresh membership')}
                            style={[styles.refreshButton, { backgroundColor: colors.chrome.common.primaryTint }]}
                        >
                            <RefreshCw size={scale(17)} color={colors.chrome.primary} />
                        </PressableScale>
                    </View>
                ) : null}

                {!overview.trial.used && trialPlan ? (
                    <View style={[styles.trialBand, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}>
                        <View style={styles.planCopy}>
                            <Text variant='body' className='font-body-semi'>
                                {translatedPlanName(trialPlan)}
                            </Text>
                            <Text variant='body-sm' style={[styles.planDescription, { color: colors.brand.text.subtitle }]}>
                                {t(`membership_plans.${trialPlan.slug}.description`, `${trialPlan.durationDays} ${t('days', 'days')}`)}
                            </Text>
                        </View>
                        <GradientButton
                            title={t('start_free_trial', 'Start free trial')}
                            onPress={() => void startTrial(trialPlan)}
                            loading={startingPlan === trialPlan.slug}
                            disabled={Boolean(startingPlan) || Boolean(openingPlan)}
                            widthMode='full'
                            height={46}
                            textSize={15}
                        />
                    </View>
                ) : null}

                {paidPlans.length ? (
                    <View style={styles.sectionHeader}>
                        <Text variant='h3'>{t('memberships', 'Memberships')}</Text>
                    </View>
                ) : null}

                {paidPlans.map((plan) => {
                    const features = translatedPlanFeatures(plan);
                    const paymentChoices = paymentChoicesForPlan(plan);
                    const nativeOnly = paymentChoices.length === 1
                        && paymentChoices[0].kind !== 'external_web';
                    const nativePrice = nativeProducts[plan.slug]?.displayPrice;
                    const visiblePrice = nativePrice
                        || (paymentChoices.some((choice) => choice.kind === 'external_web')
                            ? plan.price?.formatted
                            : null);
                    return (
                        <View
                            key={plan.id || plan.slug}
                            style={[
                                styles.planCard,
                                {
                                    backgroundColor: colors.chrome.common.card,
                                    borderColor: colors.brand.bg.border,
                                },
                            ]}
                        >
                            <View style={styles.planHeading}>
                                <View style={styles.planCopy}>
                                    <Text variant='h3' style={styles.planTitle}>
                                        {translatedPlanName(plan)}
                                    </Text>
                                    <Text variant='body-sm' style={[styles.planDescription, { color: colors.brand.text.subtitle }]}>
                                        {plan.durationDays} {t('days', 'days')}
                                    </Text>
                                </View>
                                {visiblePrice ? (
                                    <View style={[styles.pricePill, { backgroundColor: colors.brand.bg.surface }]}>
                                        <Text variant='body' className='font-body-bold'>
                                            {visiblePrice}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            {features.length ? (
                                <View style={styles.features}>
                                    {features.slice(0, 5).map((feature) => (
                                        <View key={feature} style={styles.feature}>
                                            <View style={[styles.check, { backgroundColor: colors.chrome.toast.success.bg }]}>
                                                <Check size={scale(13)} color={colors.chrome.toast.success.text} strokeWidth={3} />
                                            </View>
                                            <Text variant='body-sm' style={[styles.featureText, { color: colors.brand.text.subtitle }]}>
                                                {feature}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            {paymentChoices.length ? (
                                <GradientButton
                                    title={paymentChoices.length > 1
                                        ? t('choose_payment_method', 'Choose how to pay')
                                        : paymentChoices[0].label}
                                    onPress={() => {
                                        if (!requireVerified('checkout')) return;
                                        setPaymentPlan(plan);
                                    }}
                                    loading={openingPlan === plan.slug || Boolean(busyPaymentChoice)}
                                    disabled={Boolean(openingPlan) || Boolean(busyPaymentChoice) || checkoutState === 'pending' || checkoutState === 'refreshing'}
                                    widthMode='full'
                                    height={48}
                                    textSize={15}
                                    rightIcon={nativeOnly
                                        ? <ShoppingBag size={scale(18)} color={colors.chrome.common.inverseText} />
                                        : <CreditCard size={scale(18)} color={colors.chrome.common.inverseText} />}
                                />
                            ) : (
                                <View style={[styles.paymentUnavailable, { backgroundColor: colors.brand.bg.surface }]}>
                                    {nativeCatalogLoading ? (
                                        <ActivityIndicator size='small' color={colors.chrome.primary} />
                                    ) : null}
                                    <Text variant='body-sm' style={[styles.paymentUnavailableText, { color: colors.brand.text.subtitle }]}>
                                        {nativeCatalogLoading
                                            ? t('loading_payment_options', 'Loading payment options...')
                                            : nativeCatalogError
                                                ? t('payment_options_unavailable', 'Payment options could not be loaded. Pull down to try again.')
                                                : t('payment_not_available_region', 'This plan is not available for purchase in your region yet.')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                })}

            </ScrollView>
            <MembershipPaymentSheet
                visible={Boolean(paymentPlan)}
                planName={paymentPlan ? translatedPlanName(paymentPlan) : ''}
                choices={paymentPlan ? paymentChoicesForPlan(paymentPlan) : []}
                busyChoice={busyPaymentChoice}
                onClose={() => {
                    if (!busyPaymentChoice) setPaymentPlan(null);
                }}
                onChoose={(choice) => void choosePayment(choice)}
            />
            <GiftCardRedemptionSheet
                visible={giftCardOpen}
                busy={giftCardBusy}
                error={giftCardError}
                onClose={() => {
                    if (!giftCardBusy) setGiftCardOpen(false);
                }}
                onRedeem={(code, pin) => void redeemGiftCard(code, pin)}
            />
            <MembershipHistorySheet
                visible={historyOpen}
                items={historyItems}
                loading={historyLoading}
                loadingMore={historyLoadingMore}
                hasMore={historyHasMore}
                error={historyError}
                onClose={() => setHistoryOpen(false)}
                onRetry={() => void loadHistory()}
                onLoadMore={() => {
                    if (historyCursor) void loadHistory(historyCursor, true);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    scroll: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: {
        paddingHorizontal: scale(16),
        paddingTop: scale(16),
        paddingBottom: scale(120),
        gap: scale(14),
    },
    notice: {
        borderWidth: 1,
        borderRadius: scale(8),
        padding: scale(14),
        gap: scale(12),
    },
    inlineAction: {
        minHeight: scale(42),
        paddingHorizontal: scale(14),
        borderRadius: scale(8),
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    statusPanel: {
        borderWidth: 1,
        borderRadius: scale(8),
        padding: scale(16),
    },
    statusHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
    statusIcon: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusCopy: { flex: 1 },
    statusTitle: { marginTop: scale(4), fontSize: scale(20) },
    statusMeta: {
        marginTop: scale(14),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: scale(8),
    },
    quickActions: { flexDirection: 'row', gap: scale(10) },
    quickAction: {
        flex: 1,
        minWidth: 0,
        minHeight: scale(44),
        borderWidth: 1,
        borderRadius: scale(8),
        paddingHorizontal: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(8),
    },
    countBadge: {
        minWidth: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        paddingHorizontal: scale(5),
        alignItems: 'center',
        justifyContent: 'center',
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
    processingPanel: {
        borderWidth: 1,
        borderRadius: scale(8),
        padding: scale(12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    processingCopy: { flex: 1 },
    refreshButton: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
    },
    trialBand: {
        borderWidth: 1,
        borderRadius: scale(8),
        padding: scale(16),
        gap: scale(14),
    },
    sectionHeader: { paddingTop: scale(4) },
    planCard: {
        borderWidth: 1,
        borderRadius: scale(8),
        padding: scale(16),
        gap: scale(16),
    },
    planHeading: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: scale(12),
    },
    planCopy: { flex: 1, minWidth: 0 },
    planTitle: { fontSize: scale(20) },
    planDescription: { marginTop: scale(5), lineHeight: scale(20) },
    pricePill: {
        borderRadius: scale(8),
        paddingHorizontal: scale(12),
        paddingVertical: scale(8),
        flexShrink: 0,
    },
    features: { gap: scale(10) },
    feature: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(9) },
    check: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    featureText: { flex: 1, lineHeight: scale(20) },
    paymentUnavailable: {
        minHeight: scale(48),
        borderRadius: scale(8),
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(9),
    },
    paymentUnavailableText: { flex: 1, lineHeight: scale(19), textAlign: 'center' },
});
