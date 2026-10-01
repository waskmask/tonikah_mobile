import { accountService } from '@/lib/accountService';
import { authService } from '@/lib/authService';

export const SETTINGS_DATA_STALE_TIME_MS = 30_000;

export async function fetchActiveSessions() {
    const result = await authService.listSessions();
    if (!result.success) {
        throw new Error(result.message || 'sessions_load_failed');
    }
    return result.sessions || [];
}

export async function fetchPrivacyConsent() {
    const result = await accountService.getPrivacyConsent();
    if (!result.success || !result.consent) {
        throw new Error(result.message || 'privacy_consent_load_failed');
    }
    return result.consent;
}
