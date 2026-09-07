export type MessagingAccess = {
    required: boolean;
    allowed: boolean;
    membershipActive: boolean;
    status: string;
    reason: string | null;
    validUntil: string | null;
    evaluatedAt: string;
    billingMode?: 'one_time' | 'recurring';
    autoRenew?: boolean;
    renewalStatus?: string | null;
};

export type TrialOffer = {
    available: boolean;
    planSlug: string | null;
    durationDays: number;
};

export function canOpenMessaging(access?: MessagingAccess | null, now = Date.now()) {
    if (!access) return false;
    if (!access.required) return true;
    if (!access.allowed || !access.membershipActive) return false;
    const evaluated = new Date(access.evaluatedAt).getTime();
    const expires = access.validUntil ? new Date(access.validUntil).getTime() : NaN;
    if (!Number.isFinite(expires)) return false;
    const serverOffset = Number.isFinite(evaluated) ? evaluated - now : 0;
    return now + serverOffset < expires;
}

export function accessExpiresIn(access?: MessagingAccess | null, now = Date.now()) {
    if (!access?.validUntil) return null;
    const evaluated = new Date(access.evaluatedAt).getTime();
    const expires = new Date(access.validUntil).getTime();
    if (!Number.isFinite(expires)) return null;
    const serverOffset = Number.isFinite(evaluated) ? evaluated - now : 0;
    return Math.max(0, expires - (now + serverOffset));
}

const promoKey = (userId: string) => `membership-message-promo:${userId}`;

export async function shouldShowMembershipPromo(userId: string) {
    if (!userId) return false;
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const today = new Date().toLocaleDateString('en-CA');
    const shown = await AsyncStorage.getItem(promoKey(userId));
    if (shown === today) return false;
    await AsyncStorage.setItem(promoKey(userId), today);
    return true;
}
