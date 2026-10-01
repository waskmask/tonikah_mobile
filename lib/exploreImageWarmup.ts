import { Image } from 'expo-image';
import { firstProfileImage } from '@/lib/exploreProfile';

const FIRST_IMAGE_WARMUP_LIMIT_MS = 350;

export async function warmFirstExploreImage(profiles: any[]): Promise<void> {
    const uri = firstProfileImage(profiles[0]);
    if (!uri) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, FIRST_IMAGE_WARMUP_LIMIT_MS);
    });
    await Promise.race([
        Image.prefetch(uri, 'memory-disk').then(() => undefined).catch(() => undefined),
        timeout,
    ]);
    if (timeoutId) clearTimeout(timeoutId);
}
