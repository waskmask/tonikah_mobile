import { api } from './api';

export type PrivacyConsent = {
    aiModeration?: {
        allowed: boolean | null;
        version: string | null;
        currentVersion: string;
        decidedAt: string | null;
        requiresDecision: boolean;
    };
    agreed: boolean;
    termsVersion?: string | null;
    privacyVersion?: string | null;
    currentTermsVersion?: string | null;
    currentPrivacyVersion?: string | null;
    requiresReaccept?: boolean;
    marketingOptIn: boolean;
    consentAt?: string | null;
    email?: string | null;
    updatedAt?: string | null;
};

export type PrivacyConsentResponse = {
    success: boolean;
    message?: string;
    consent?: PrivacyConsent;
};

export type AccountDeleteResponse = {
    success: boolean;
    message?: string;
    deleted?: boolean;
};

export const accountService = {
    updateAiModerationConsent: (allowed: boolean, version: string): Promise<PrivacyConsentResponse> =>
        api.patch('/account/me/ai-moderation-consent', { allowed, version }),
    getPrivacyConsent: (): Promise<PrivacyConsentResponse> =>
        api.get('/account/me/privacy-consent'),

    updateMarketingOptIn: (marketingOptIn: boolean): Promise<PrivacyConsentResponse> =>
        api.patch('/account/me/privacy-consent', { marketingOptIn }),

    acceptLatestConsent: (): Promise<PrivacyConsentResponse> =>
        api.post('/account/me/privacy-consent/accept-latest', { agreed: true }),

    // Same scope as web: account/profile/consent/sessions/settings — no chat messages or media.
    exportMe: (): Promise<{ success?: boolean; message?: string } & Record<string, unknown>> =>
        api.get('/account/me/export'),

    deleteMe: (deletedReason: string, lang?: string): Promise<AccountDeleteResponse> =>
        api.deleteWithBody('/account/me', { deletedReason, ...(lang ? { lang } : {}) }),
};
