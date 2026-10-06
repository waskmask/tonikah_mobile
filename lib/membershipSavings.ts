import type { MembershipPlan } from './membershipService';
import type { NativeStoreProduct } from './nativeMembershipPurchase';

export function membershipSavingsPercent(
    plan: MembershipPlan,
    monthlyPlan: MembershipPlan | undefined,
    products: Record<string, NativeStoreProduct>,
): number | null {
    if (!monthlyPlan || monthlyPlan.durationDays !== 30 || plan.durationDays <= 30) return null;
    const months = plan.durationDays === 365 ? 12 : plan.durationDays / 30;
    if (!Number.isInteger(months)) return null;

    const product = products[plan.slug];
    const monthlyProduct = products[monthlyPlan.slug];
    // Never compare a store price with a web/catalog price.
    const useStore = Boolean(product || monthlyProduct);
    const amount = useStore ? product?.price : plan.price?.amountMinor;
    const monthlyAmount = useStore ? monthlyProduct?.price : monthlyPlan.price?.amountMinor;
    const currency = useStore ? product?.currency : plan.price?.currency;
    const monthlyCurrency = useStore ? monthlyProduct?.currency : monthlyPlan.price?.currency;
    if (typeof amount !== 'number' || typeof monthlyAmount !== 'number'
        || !Number.isFinite(amount) || !Number.isFinite(monthlyAmount)
        || amount <= 0 || monthlyAmount <= 0 || !currency || currency !== monthlyCurrency) return null;
    if (!useStore && plan.price?.region !== monthlyPlan.price?.region) return null;

    const saving = Math.round((1 - amount / (monthlyAmount * months)) * 100);
    return saving > 0 && saving < 100 ? saving : null;
}
