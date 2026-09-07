import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import { api, ApiResponse } from './api';
import type { MessagingAccess, TrialOffer } from './messagingAccess';

export type MembershipProvider =
    | 'trial'
    | 'stripe'
    | 'razorpay'
    | 'apple_iap'
    | 'google_play'
    | 'gift_card'
    | 'admin_grant'
    | string;

export type MembershipRecord = {
    status?: string;
    provider?: MembershipProvider;
    planSlug?: string;
    planName?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    updatedAt?: string;
};

export type MembershipOverview = {
    membership: MembershipRecord | null;
    isActive: boolean;
    daysLeft: number;
    trial: { used: boolean; active: boolean; daysLeft: number };
    historyCount: number;
    messagingAccess?: MessagingAccess;
    trialOffer?: TrialOffer;
};

export type MembershipPlan = {
    id: string;
    slug: string;
    displayName: string;
    kind?: 'paid' | 'trial';
    durationDays: number;
    features: string[];
    checkoutEnabled: boolean;
    gateway?: string;
    price: {
        region: string;
        currency: string;
        amountMinor: number;
        formatted: string;
    } | null;
};

export type MobilePurchaseOption = {
    kind: 'apple_iap' | 'google_play' | 'external_web';
    enabled: boolean;
    productId?: string;
    productType?: 'in-app' | 'subs';
    products?: Record<string, {
        productId: string;
        productType: 'in-app' | 'subs';
    }>;
};

export type MobilePurchasePolicy = {
    mode: 'hidden' | 'external_web' | 'native_store' | 'store_and_external';
    externalHandoffEnabled: boolean;
    reason?: string;
    options?: MobilePurchaseOption[];
    restorePurchases?: boolean;
};

export type MembershipPlansResponse = ApiResponse & {
    ok?: boolean;
    region?: string;
    countryCode?: string;
    plans?: MembershipPlan[];
    mobilePurchase?: MobilePurchasePolicy;
};

export type MembershipOverviewResponse = ApiResponse & Partial<MembershipOverview> & {
    ok?: boolean;
};

export type TrialActivationResponse = ApiResponse & {
    messagingAccess?: MessagingAccess;
    trialOffer?: TrialOffer;
};

export type MembershipHistoryItem = {
    id: string;
    provider?: MembershipProvider;
    transactionId?: string;
    planName?: string;
    planKey?: string;
    region?: string;
    currency?: string;
    couponCode?: string;
    finalAmountMinor?: number;
    durationDays?: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    purchasedAt?: string | null;
};

export type MembershipHistoryResponse = ApiResponse & {
    history?: MembershipHistoryItem[];
    pageInfo?: {
        hasMore?: boolean;
        nextCursor?: string | null;
    };
};

export type GiftCardRedemptionResponse = ApiResponse & {
    purchaseId?: string;
    documentId?: string;
    planName?: string;
    entitlementEnd?: string;
};

export type NativePurchaseVerification = {
    intentId: string;
    provider: 'apple_iap' | 'google_play';
    planSlug: string;
    productId: string;
    purchaseToken: string;
    transactionId: string;
    transactionDate: number;
    storefrontCountryCode?: string | null;
};

export type NativePurchaseIntentResponse = ApiResponse & {
    intentId?: string;
    accountToken?: string;
    expiresAt?: string;
};

export type NativePurchaseVerificationResponse = ApiResponse & {
    verified?: boolean;
    entitlementActive?: boolean;
    purchaseId?: string;
};

type CheckoutClientContext = {
    appVersion: string;
    appBuild: string;
    osVersion: string;
    locale: string;
    appEnvironment: string;
};

function checkoutClientContext(): CheckoutClientContext {
    const config = Constants.expoConfig;
    const appBuild = Platform.OS === 'ios'
        ? Constants.platform?.ios?.buildNumber || config?.ios?.buildNumber
        : Platform.OS === 'android'
            ? Constants.platform?.android?.versionCode || config?.android?.versionCode
            : '';

    return {
        appVersion: String(config?.version || ''),
        appBuild: String(appBuild || ''),
        osVersion: String(Platform.Version || ''),
        locale: String(getLocales()[0]?.languageTag || ''),
        appEnvironment: String(
            process.env.EXPO_PUBLIC_APP_ENV || config?.extra?.APP_ENV || ''
        ),
    };
}

export const membershipService = {
    me: (): Promise<MembershipOverviewResponse> => api.get('/membership/me'),
    plans: (storefrontCountryCode = ''): Promise<MembershipPlansResponse> => {
        const query = storefrontCountryCode
            ? `?storefrontCountryCode=${encodeURIComponent(storefrontCountryCode)}`
            : '';
        return api.get(`/membership/plans${query}`);
    },
    startTrial: (planSlugOrId?: string): Promise<TrialActivationResponse> =>
        api.post('/membership/trial/start', { planSlugOrId }),
    history: (cursor = '', limit = 10): Promise<MembershipHistoryResponse> => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        return api.get(`/membership/history?${params.toString()}`);
    },
    redeemGiftCard: (code: string, pin: string): Promise<GiftCardRedemptionResponse> =>
        api.post('/giftcards/redeem', {
            code,
            pin,
            lang: String(getLocales()[0]?.languageCode || 'en'),
        }),
    createCheckoutHandoff: (planSlug: string, storefrontCountryCode = ''): Promise<ApiResponse> =>
        api.post('/app-user/membership-handoff/create', {
            planSlug,
            storefrontCountryCode,
            clientContext: checkoutClientContext(),
        }),
    createNativePurchaseIntent: (input: {
        provider: 'apple_iap' | 'google_play';
        planSlug: string;
        productId: string;
    }): Promise<NativePurchaseIntentResponse> =>
        api.post('/membership/native/intent', {
            ...input,
            clientContext: checkoutClientContext(),
        }),
    verifyNativePurchase: (
        purchase: NativePurchaseVerification,
    ): Promise<NativePurchaseVerificationResponse> =>
        api.post('/membership/native/verify', {
            ...purchase,
            clientContext: checkoutClientContext(),
        }),
};
