import { Platform } from 'react-native';
import { api } from '@/lib/api';

export type MobilePlatformConfig = {
    minimumBuild: number;
    storeUrl: string;
};

export type MobileAppConfig = {
    ios: MobilePlatformConfig;
    android: MobilePlatformConfig;
    forceAfter: string | null;
};

function platformConfig(value: unknown): MobilePlatformConfig | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<MobilePlatformConfig>;
    const minimumBuild = Number(candidate.minimumBuild);
    const storeUrl = typeof candidate.storeUrl === 'string' ? candidate.storeUrl.trim() : '';
    if (!Number.isInteger(minimumBuild) || minimumBuild < 1) return null;

    return { minimumBuild, storeUrl };
}

export async function fetchMobileAppConfig(): Promise<MobileAppConfig | null> {
    const response = await api.get('/mobile-config');
    const data = response?.data;
    const ios = platformConfig(data?.ios);
    const android = platformConfig(data?.android);
    if (!response?.success || !ios || !android) return null;

    return {
        ios,
        android,
        forceAfter: typeof data.forceAfter === 'string' && data.forceAfter.trim()
            ? data.forceAfter
            : null,
    };
}

export function requiredUpdateForBuild(
    config: MobileAppConfig,
    nativeBuildVersion: string | null,
    now = Date.now(),
): MobilePlatformConfig | null {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;

    const currentBuild = Number(nativeBuildVersion);
    if (!Number.isInteger(currentBuild) || currentBuild < 1) return null;

    const target = config[Platform.OS];
    if (!target.storeUrl || currentBuild >= target.minimumBuild) return null;

    if (config.forceAfter) {
        const forceTimestamp = Date.parse(config.forceAfter);
        if (!Number.isFinite(forceTimestamp) || now < forceTimestamp) return null;
    }

    return target;
}
