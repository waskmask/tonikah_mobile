import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Purchase, PurchaseError } from 'react-native-iap';

import { membershipService, type MobilePurchaseOption } from './membershipService';

export type NativeStoreKind = 'apple_iap' | 'google_play';

export type NativeStoreProduct = {
    id: string;
    title: string;
    description: string;
    displayPrice: string;
    type: 'in-app' | 'subs';
};

export type NativeProductConfig = {
    productId: string;
    productType: 'in-app' | 'subs';
};

export type PurchaseResult = {
    purchaseId?: string;
    pending?: boolean;
};

type PendingNativePurchase = {
    intentId: string;
    accountToken: string;
    provider: NativeStoreKind;
    planSlug: string;
    config: NativeProductConfig;
    expiresAt: string;
};

const PENDING_PURCHASE_KEY = 'membership.nativePurchase.pending.v1';

function nativeKind(): NativeStoreKind | null {
    if (Platform.OS === 'ios') return 'apple_iap';
    if (Platform.OS === 'android') return 'google_play';
    return null;
}

export function nativeProductConfig(
    option: MobilePurchaseOption | undefined,
    planSlug: string,
): NativeProductConfig | null {
    if (!option?.enabled || option.kind !== nativeKind()) return null;
    const product = option.products?.[planSlug];
    if (product?.productId) return product;
    if (!option.productId) return null;
    return {
        productId: option.productId,
        productType: option.productType || 'in-app',
    };
}

async function loadIap() {
    if (!nativeKind()) throw new Error('native_store_unavailable');
    return import('react-native-iap');
}

async function savePendingPurchase(value: PendingNativePurchase) {
    await SecureStore.setItemAsync(PENDING_PURCHASE_KEY, JSON.stringify(value));
}

async function clearPendingPurchase() {
    await SecureStore.deleteItemAsync(PENDING_PURCHASE_KEY);
}

function purchaseMatchesIntent(purchase: Purchase, pending: PendingNativePurchase) {
    if (purchase.productId !== pending.config.productId) return false;
    if (pending.provider === 'apple_iap' && 'appAccountToken' in purchase) {
        return !purchase.appAccountToken
            || purchase.appAccountToken.toLowerCase() === pending.accountToken.toLowerCase();
    }
    if (pending.provider === 'google_play' && 'obfuscatedAccountIdAndroid' in purchase) {
        return !purchase.obfuscatedAccountIdAndroid
            || purchase.obfuscatedAccountIdAndroid === pending.accountToken;
    }
    return true;
}

async function verifyAndFinishPurchase(
    iap: typeof import('react-native-iap'),
    purchase: Purchase,
    pending: PendingNativePurchase,
) {
    const purchaseToken = purchase.purchaseToken || '';
    if (!purchaseToken || !purchase.transactionId) {
        throw new Error('native_purchase_proof_missing');
    }
    const verification = await membershipService.verifyNativePurchase({
        intentId: pending.intentId,
        provider: pending.provider,
        planSlug: pending.planSlug,
        productId: purchase.productId,
        purchaseToken,
        transactionId: purchase.transactionId,
        transactionDate: purchase.transactionDate,
        storefrontCountryCode: 'storefrontCountryCodeIOS' in purchase
            ? purchase.storefrontCountryCodeIOS
            : null,
    });
    if (!verification.success || !verification.verified || !verification.entitlementActive) {
        throw new Error(verification.message || 'native_purchase_verification_failed');
    }
    await iap.finishTransaction({
        purchase,
        isConsumable: pending.config.productType === 'in-app',
    });
    await clearPendingPurchase();
    return verification.purchaseId;
}

export async function fetchNativeMembershipProducts(
    configs: NativeProductConfig[],
): Promise<Record<string, NativeStoreProduct>> {
    if (!configs.length) return {};
    const iap = await loadIap();
    await iap.initConnection();
    const groups = ['in-app', 'subs'] as const;
    const fetched = await Promise.all(groups.map(async (type) => {
        const skus = [...new Set(
            configs.filter((config) => config.productType === type).map((config) => config.productId),
        )];
        if (!skus.length) return [];
        return (await iap.fetchProducts({ skus, type })) || [];
    }));
    return Object.fromEntries(fetched.flat().map((product) => [
        product.id,
        {
            id: product.id,
            title: product.title,
            description: product.description,
            displayPrice: product.displayPrice,
            type: product.type,
        },
    ]));
}

export async function getNativeStorefrontCountryCode(): Promise<string> {
    if (!nativeKind()) return '';
    const iap = await loadIap();
    await iap.initConnection();
    return String(await iap.getStorefront() || '').trim().toUpperCase();
}

export async function purchaseNativeMembership(
    planSlug: string,
    config: NativeProductConfig,
): Promise<PurchaseResult> {
    const provider = nativeKind();
    if (!provider) throw new Error('native_store_unavailable');

    const iap = await loadIap();
    await iap.initConnection();
    const intent = await membershipService.createNativePurchaseIntent({
        provider,
        planSlug,
        productId: config.productId,
    });
    if (!intent.success || !intent.intentId || !intent.accountToken) {
        throw new Error(intent.message || 'native_purchase_intent_failed');
    }
    const intentId = intent.intentId;
    const accountToken = intent.accountToken;
    const pending: PendingNativePurchase = {
        intentId,
        accountToken,
        provider,
        planSlug,
        config,
        expiresAt: String(intent.expiresAt || ''),
    };
    await savePendingPurchase(pending);

    return new Promise<PurchaseResult>((resolve, reject) => {
        let settled = false;
        let purchaseSubscription: ReturnType<typeof iap.purchaseUpdatedListener> | null = null;
        let errorSubscription: ReturnType<typeof iap.purchaseErrorListener> | null = null;
        const cleanup = () => {
            purchaseSubscription?.remove();
            errorSubscription?.remove();
            purchaseSubscription = null;
            errorSubscription = null;
        };
        const fail = (error: Error | PurchaseError) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (isPurchaseCancelled(error)) void clearPendingPurchase();
            reject(error);
        };

        purchaseSubscription = iap.purchaseUpdatedListener(async (purchase: Purchase) => {
            if (settled || !purchaseMatchesIntent(purchase, pending)) return;
            if (purchase.purchaseState === 'pending') {
                settled = true;
                cleanup();
                resolve({ pending: true });
                return;
            }
            try {
                const purchaseId = await verifyAndFinishPurchase(iap, purchase, pending);
                if (settled) return;
                settled = true;
                cleanup();
                resolve({ purchaseId });
            } catch (error) {
                fail(error instanceof Error ? error : new Error('native_purchase_verification_failed'));
            }
        });

        errorSubscription = iap.purchaseErrorListener((error) => fail(error));

        void iap.requestPurchase({
            request: Platform.OS === 'ios'
                ? {
                    apple: {
                        sku: config.productId,
                        appAccountToken: accountToken,
                    },
                }
                : {
                    google: {
                        skus: [config.productId],
                        obfuscatedAccountId: accountToken,
                    },
                },
            type: config.productType,
        }).catch((error) => fail(error instanceof Error ? error : new Error('native_purchase_failed')));
    });
}

export async function recoverPendingNativeMembershipPurchase(): Promise<PurchaseResult | null> {
    const raw = await SecureStore.getItemAsync(PENDING_PURCHASE_KEY);
    if (!raw) return null;
    let pending: PendingNativePurchase;
    try {
        pending = JSON.parse(raw) as PendingNativePurchase;
    } catch {
        await clearPendingPurchase();
        return null;
    }
    if (!pending.intentId || !pending.accountToken || !pending.config?.productId) {
        await clearPendingPurchase();
        return null;
    }
    if (pending.expiresAt && new Date(pending.expiresAt).getTime() <= Date.now()) {
        await clearPendingPurchase();
        return null;
    }
    if (pending.provider !== nativeKind()) return null;

    const iap = await loadIap();
    await iap.initConnection();
    const purchases = await iap.getAvailablePurchases();
    const purchase = purchases.find((candidate) => purchaseMatchesIntent(candidate, pending));
    if (!purchase) return null;
    if (purchase.purchaseState === 'pending') return { pending: true };
    const purchaseId = await verifyAndFinishPurchase(iap, purchase, pending);
    return { purchaseId };
}

export async function closeNativeMembershipStore() {
    if (!nativeKind()) return;
    const iap = await loadIap();
    await iap.endConnection();
}

export function isPurchaseCancelled(error: unknown) {
    const code = String((error as PurchaseError | undefined)?.code || '').toLowerCase();
    return code.includes('cancel');
}
