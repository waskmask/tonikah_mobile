import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_VERIFICATION_TTL_MS = 15 * 60 * 1000;

function verificationKey(userId: string) {
    return `tn_explore_location_verified_at:${userId}`;
}

export async function hasRecentExploreLocationVerification(userId: string): Promise<boolean> {
    if (!userId) return false;
    const verifiedAt = Number(
        await AsyncStorage.getItem(verificationKey(userId)).catch(() => null),
    );
    return Number.isFinite(verifiedAt) && Date.now() - verifiedAt < LOCATION_VERIFICATION_TTL_MS;
}

export async function rememberExploreLocationVerification(userId: string): Promise<void> {
    if (!userId) return;
    await AsyncStorage.setItem(verificationKey(userId), String(Date.now())).catch(() => undefined);
}
