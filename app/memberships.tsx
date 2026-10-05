import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Check, Clock3, Gift, History, RefreshCw, ShieldCheck } from '@/components/ui/icons/PhosphorCompat';
import { CaretDown, CaretUp } from 'phosphor-react-native';

import { AppBackTitleBar } from '@/components/app/AppBackTitleBar';
import {
    MembershipPaymentSheet,
    type MembershipPaymentChoice,
} from '@/components/membership/MembershipPaymentSheet';
import { GiftCardRedemptionSheet } from '@/components/membership/GiftCardRedemptionSheet';
import { MembershipHistorySheet } from '@/components/membership/MembershipHistorySheet';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { InlineLoadError } from '@/components/ui/InlineLoadError';
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
import { firstSearchParam, sanitizeAuthReturnPath } from '@/lib/authReturn';

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

function translatedMembershipBenefits() {
    const translated = i18n.t('membership_plans.shared_features', {
        defaultValue: [],
        returnObjects: true,
    });
    return Array.isArray(translated) ? translated.map(String) : [];
}

function planDurationParts(days: number, locale: string) {
    const unit = days >= 365 && days % 365 === 0 ? 'year'
        : days >= 30 && days % 30 === 0 ? 'month'
            : days > 0 && days % 7 === 0 ? 'week' : 'day';
    const amount = days / (unit === 'year' ? 365 : unit === 'month' ? 30 : unit === 'week' ? 7 : 1);
    const unitLabel = String(i18n.t(`membership_duration.${unit}`, {
        count: amount,
        defaultValue: amount === 1 ? unit : `${unit}s`,
    }));
    const number = new Intl.NumberFormat(locale).format(amount);
    return {
        amount: number,
        unit: unitLabel,
        label: `${number} ${unitLabel}`,
    };
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
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
    const { currentLanguage, isRTL } = useLanguage();
    const { requireVerified } = useEmailVerificationGuard();
    const toast = useToast();
    const [plans, setPlans] = useState<MembershipPlan[]>([]);
    const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);
    const [benefitsExpanded, setBenefitsExpanded] = useState(false);
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
    const returnHandledRef = useRef(false);
    const returnTo = sanitizeAuthReturnPath(firstSearchParam(params.returnTo));

    const completeMembershipReturn = useCallback((nextOverview: MembershipOverview) => {
        if (!nextOverview.isActive || !returnTo || returnHandledRef.current) return;
        returnHandledRef.current = true;
        router.replace(returnTo as any);
    }, [returnTo]);

    useEffect(() => {
        returnHandledRef.current = false;
    }, [returnTo]);

    const paidPlans = useMemo(() => plans.filter((plan) => !isTrialPlan(plan)), [plans]);
    const selectedPlan = paidPlans.find((plan) => plan.slug === selectedPlanSlug) || paidPlans[0];
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
                completeMembershipReturn(nextOverview);
                return nextOverview;
            })
            .finally(() => {
                refreshInFlightRef.current = null;
            });
        refreshInFlightRef.current = request;
        return request;
    }, [completeMembershipReturn]);

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
                toast.show(apiMessage(response.message), 'error', 3500);
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
            toast.show(t('network_error', 'No internet connection. Please check and try again.'), 'error', 3500);
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
                toast.show(apiMessage(response.message), 'error', 3500);
                setCheckoutState('idle');
                return;
            }
            if (!isTrustedCheckoutUrl(response.handoffUrl)) {
                toast.show(t('checkout_untrusted_url', 'Secure checkout returned an invalid address.'), 'error', 3500);
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
            toast.show(t('checkout_open_failed', 'Could not open secure checkout. Please try again.'), 'error', 3500);
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
                toast.show(
                    t(
                        'native_purchase_failed',
                        'We could not confirm this purchase yet. Check your membership before trying again, or contact support.',
                    ),
                    'error',
                    4500,
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
            <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
                <AppBackTitleBar title="" fallbackHref="/settings" showMenu />
                <View style={styles.centered}>
                    <ActivityIndicator color={colors.chrome.primary} />
                </View>
            </View>
        );
    }

    if (loadError) {
        return (
            <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
                <AppBackTitleBar title="" fallbackHref="/settings" showMenu />
                <View style={styles.centered}>
                    <InlineLoadError
                        title={t('membership_load_failed', 'Could not load membership')}
                        description={t('network_error', 'No internet connection. Please check and try again.')}
                        retryLabel={t('btn_try_again', 'Try Again')}
                        onRetry={() => {
                            setLoading(true);
                            void loadScreen();
                        }}
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: colors.brand.bg.surface }]}>
            <AppBackTitleBar title="" fallbackHref="/settings" showMenu />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
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

                {paidPlans.length > 0 && (
                    <View style={styles.benefitsSection}>
                        <Text variant="caption" className="font-body-bold" align="center"
                            style={[styles.membershipTitle, { color: colors.chrome.common.membershipGold }]}>
                            {t('membership_plans_title', 'Membership plans')}
                        </Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded: benefitsExpanded }}
                            onPress={() => setBenefitsExpanded((expanded) => !expanded)}
                            style={[styles.benefitsToggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                        >
                            <Text variant="body-sm" className="font-body-semi">
                                {benefitsExpanded ? t('membership_hide_benefits', 'Hide benefits') : t('membership_show_benefits', 'Show benefits')}
                            </Text>
                            {benefitsExpanded
                                ? <CaretUp size={18} color={colors.brand.text.body} />
                                : <CaretDown size={18} color={colors.brand.text.body} />}
                        </Pressable>
                        {benefitsExpanded && <View style={styles.features}>
                            {translatedMembershipBenefits().map((feature, index) => (
                                <View key={index} style={[styles.feature, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                    <Check size={18} color={colors.chrome.primary} />
                                    <Text variant="body-sm" style={styles.featureText}>{feature}</Text>
                                </View>
                            ))}
                        </View>}
                    </View>
                )}

                <View accessibilityRole="radiogroup" accessibilityLabel={t('memberships', 'Memberships')} style={styles.planOptions}>
                    {paidPlans.map((plan) => {
                        const selected = plan.slug === selectedPlan?.slug;
                        const price = nativeProducts[plan.slug]?.displayPrice || plan.price?.formatted;
                        const duration = planDurationParts(plan.durationDays, currentLanguage);
                        return (
                            <Pressable
                                key={plan.id || plan.slug}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: selected }}
                                accessibilityLabel={[translatedPlanName(plan), duration.label, price].filter(Boolean).join(', ')}
                                onPress={() => setSelectedPlanSlug(plan.slug)}
                                style={[styles.planOption, {
                                    flexDirection: isRTL ? 'row-reverse' : 'row',
                                    borderColor: selected ? colors.chrome.primary : colors.brand.bg.border,
                                    backgroundColor: selected ? colors.chrome.common.primaryTint : colors.chrome.common.card,
                                }]}
                            >
                                <Text className="font-body-bold" style={[styles.durationNumber, { backgroundColor: colors.chrome.toast.info.bg }]}>{duration.amount}</Text>
                                <View style={styles.planCopy}>
                                    <Text variant="body" className="font-body-bold">{duration.unit}</Text>
                                    {price ? <Text variant="body-sm" style={styles.optionPrice}>{price}</Text> : null}
                                </View>
                                {selected && <View style={[styles.selectedBadge, {
                                    backgroundColor: colors.chrome.primary,
                                    ...(isRTL ? { left: 12 } : { right: 12 }),
                                }]}><Check size={16} color={colors.chrome.common.inverseText} /></View>}
                            </Pressable>
                        );
                    })}
                </View>

                {(selectedPlan ? [selectedPlan] : []).map((plan) => {
                    const paymentChoices = paymentChoicesForPlan(plan);
                    const visiblePrice = nativeProducts[plan.slug]?.displayPrice || plan.price?.formatted;
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
                                <GradientButton
                                    title={visiblePrice ? `${visiblePrice}  ${t('continue', 'Continue')}` : t('continue', 'Continue')}
                                    onPress={() => {
                                        if (!requireVerified('checkout')) return;
                                        setPaymentPlan(plan);
                                    }}
                                    loading={openingPlan === plan.slug || Boolean(busyPaymentChoice)}
                                    disabled={!paymentChoices.length || Boolean(openingPlan) || Boolean(busyPaymentChoice) || checkoutState === 'pending' || checkoutState === 'refreshing'}
                                    widthMode='full'
                                    height={48}
                                    textSize={15}
                                />
                            {!paymentChoices.length && (
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
                        containerStyle={styles.quickActionContainer}
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
                        <Text variant='body-sm' className='font-body-semi' style={styles.quickActionLabel}>
                            {t('redeem_gift_card', 'Redeem gift card')}
                        </Text>
                    </PressableScale>
                    <PressableScale
                        onPress={openHistory}
                        containerStyle={styles.quickActionContainer}
                        accessibilityRole='button'
                        accessibilityLabel={t('membership_history', 'Membership history')}
                        style={[styles.quickAction, { backgroundColor: colors.chrome.common.card, borderColor: colors.brand.bg.border }]}
                    >
                        <History size={scale(17)} color={colors.chrome.primary} />
                        <Text variant='body-sm' className='font-body-semi' style={styles.quickActionLabel}>
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
        borderBottomWidth: StyleSheet.hairlineWidth,
        padding: 16,
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
    quickActionContainer: { flex: 1, minWidth: 0 },
    quickActionLabel: { flexShrink: 1 },
    quickAction: {
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
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        padding: 16,
        gap: scale(14),
    },
    sectionHeader: { paddingTop: scale(4) },
    planCard: {
        paddingVertical: 4,
        gap: scale(16),
    },
    membershipTitle: { fontSize: scale(16), lineHeight: scale(21), letterSpacing: 0, textTransform: 'none' },
    benefitsSection: { gap: 10 },
    benefitsToggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 8 },
    planOptions: { gap: 16, paddingTop: 8 },
    planOption: { direction: 'ltr', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2, borderRadius: 8, alignItems: 'center', gap: 16 },
    durationNumber: { fontSize: scale(32), lineHeight: 46, minWidth: 46, textAlign: 'center', flexShrink: 0, includeFontPadding: false },
    selectedBadge: { position: 'absolute', top: -12, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    optionPrice: { marginTop: 4 },
    planHeading: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: scale(12),
    },
    planCopy: { flex: 1, minWidth: 0 },
    planTitle: { fontSize: 20 },
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
