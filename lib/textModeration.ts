import { ApiResponse } from './api';
import { t } from './profileDisplay';

/**
 * Client-side handling for the backend text-moderation error shape
 * (see improvements/text-moderation-headline-bio-gemini.md):
 *
 * { success: false, code: "TEXT_MODERATION_REJECTED",
 *   moderation: { fields, issues, fieldErrors, userMessage } }
 */

// API/DB field names -> local form error keys used by edit-profile and step10.
const FIELD_ALIASES: Record<string, string> = {
    profile_headline: 'headline',
    profileHeadline: 'headline',
    headline: 'headline',
    bio: 'bio',
    company: 'company',
    about_partner: 'aboutPartner',
    partnerPreferenceAboutPartner: 'aboutPartner',
};

const ISSUE_MESSAGE_KEYS: Record<string, string> = {
    contact_email: 'text_moderation_contact_email',
    contact_phone: 'text_moderation_contact_phone',
    contact_url: 'text_moderation_contact_url',
    contact_social: 'text_moderation_contact_social',
    off_platform: 'text_moderation_contact_social',
    nsfw: 'text_moderation_nsfw',
    hate_or_racist: 'text_moderation_hate_or_racist',
    harassment: 'text_moderation_harassment',
    violence_threat: 'text_moderation_violence_threat',
    spam_or_scam: 'text_moderation_spam_or_scam',
    unsafe_discriminatory: 'text_moderation_generic',
    unknown: 'text_moderation_generic',
};

export type ModerationRejection = {
    /** Keyed by local form field names: headline, bio, company, aboutPartner. */
    fieldErrors: Record<string, string>;
    /** Localized summary suitable for a toast / alert. */
    userMessage: string;
};

function issueMessage(issues: unknown): string {
    const first = Array.isArray(issues) ? issues.find((issue) => typeof issue === 'string') : null;
    const key = (first && ISSUE_MESSAGE_KEYS[first]) || 'text_moderation_generic';
    return t(key, t('text_moderation_generic', 'This text could not be approved. Please reword it and try again.'));
}

/**
 * Returns field-level rejection messages when the save failed due to text
 * moderation, or null when the failure is unrelated (caller handles it).
 */
export function extractModerationRejection(res: ApiResponse): ModerationRejection | null {
    if (!res || res.success) return null;
    const moderation = res.moderation;
    const isModeration = res.code === 'TEXT_MODERATION_REJECTED'
        || (moderation && typeof moderation === 'object' && moderation.safe === false);
    if (!isModeration) return null;

    const fallback = issueMessage(moderation?.issues);
    const fieldErrors: Record<string, string> = {};

    const rawFieldErrors = moderation?.fieldErrors;
    if (rawFieldErrors && typeof rawFieldErrors === 'object') {
        for (const [field, message] of Object.entries(rawFieldErrors)) {
            const local = FIELD_ALIASES[field];
            if (!local) continue;
            fieldErrors[local] = typeof message === 'string' && message ? t(message, message) : fallback;
        }
    }

    // Backend may only list offending fields without per-field messages.
    if (Object.keys(fieldErrors).length === 0 && Array.isArray(moderation?.fields)) {
        for (const field of moderation.fields) {
            const local = FIELD_ALIASES[String(field)];
            if (local) fieldErrors[local] = fallback;
        }
    }

    const rawUserMessage = moderation?.userMessage || res.message;
    const userMessage = typeof rawUserMessage === 'string' && rawUserMessage
        ? t(rawUserMessage, rawUserMessage === 'text_moderation_unsafe' ? fallback : rawUserMessage)
        : fallback;

    return { fieldErrors, userMessage };
}
