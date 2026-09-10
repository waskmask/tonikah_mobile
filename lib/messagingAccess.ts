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
    clientClockOffsetMs?: number;
};

export type TrialOffer = {
    available: boolean;
    planSlug: string | null;
    durationDays: number;
};

export function withMessagingAccessClock(
    access: MessagingAccess,
    receivedAt = Date.now(),
): MessagingAccess {
    if (Number.isFinite(access.clientClockOffsetMs)) return access;
    const evaluated = new Date(access.evaluatedAt).getTime();
    return {
        ...access,
        clientClockOffsetMs: Number.isFinite(evaluated) ? evaluated - receivedAt : 0,
    };
}

function serverNow(access: MessagingAccess, now: number) {
    const offset = Number(access.clientClockOffsetMs);
    return now + (Number.isFinite(offset) ? offset : 0);
}

export function canOpenMessaging(access?: MessagingAccess | null, now = Date.now()) {
    if (!access) return false;
    if (!access.required) return true;
    if (!access.allowed || !access.membershipActive) return false;
    const expires = access.validUntil ? new Date(access.validUntil).getTime() : NaN;
    if (!Number.isFinite(expires)) return false;
    return serverNow(access, now) < expires;
}

export function accessExpiresIn(access?: MessagingAccess | null, now = Date.now()) {
    if (!access?.validUntil) return null;
    const expires = new Date(access.validUntil).getTime();
    if (!Number.isFinite(expires)) return null;
    return Math.max(0, expires - serverNow(access, now));
}

export function shouldRedactMessagingContent(
    access?: MessagingAccess | null,
    statusLoading = false,
    now = Date.now(),
) {
    if (statusLoading || !access) return true;
    return access.required && !canOpenMessaging(access, now);
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
