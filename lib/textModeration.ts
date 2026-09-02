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

// ---------------------------------------------------------------------------
// Next.js-parity warning helpers (see tonikah-frontend-next/lib/profileTextModeration.ts).
// The RN api layer resolves error bodies into ApiResponse, so these read the
// response object directly instead of an axios error.
// ---------------------------------------------------------------------------

export type ModerationField = 'headline' | 'bio' | 'company' | 'partner_about';

export type TextModerationWarning = {
    field: ModerationField;
    fields: ModerationField[];
    issues: string[];
    reasonCode: string;
    contentHash: string;
    fieldErrors: Record<string, string>;
    userMessage: string;
};

const FIELD_SET = new Set(['headline', 'bio', 'company', 'partner_about']);

export const moderationTitleKeys: Record<ModerationField, string> = {
    headline: 'moderation_text_warning_title_headline',
    bio: 'moderation_text_warning_title_bio',
    company: 'moderation_text_warning_title_company',
    partner_about: 'moderation_text_warning_title_partner_about',
};

function isModerationField(value: unknown): value is ModerationField {
    return typeof value === 'string' && FIELD_SET.has(value);
}

/** Structured warning for the Submit-Anyway modal, or null when the failure
    is not a text-moderation rejection. */
export function getTextModerationWarning(res: ApiResponse): TextModerationWarning | null {
    if (!res || res.success) return null;
    if (res.code !== 'TEXT_MODERATION_REJECTED') return null;
    const moderation = res.moderation;
    if (!moderation || typeof moderation !== 'object') return null;

    const raw = moderation as {
        fields?: unknown;
        issues?: unknown;
        reasonCode?: unknown;
        contentHash?: unknown;
        fieldErrors?: unknown;
        userMessage?: unknown;
    };

    const fields = Array.isArray(raw.fields) ? raw.fields.filter(isModerationField) : [];
    const field = fields[0];
    if (!field) return null;

    const fieldErrors =
        raw.fieldErrors && typeof raw.fieldErrors === 'object'
            ? (Object.fromEntries(
                Object.entries(raw.fieldErrors as Record<string, unknown>).filter(
                    ([, value]) => typeof value === 'string',
                ),
            ) as Record<string, string>)
            : {};

    return {
        field,
        fields,
        issues: Array.isArray(raw.issues)
            ? raw.issues.map((issue) => String(issue || '').trim()).filter(Boolean)
            : [],
        reasonCode: typeof raw.reasonCode === 'string' ? raw.reasonCode : '',
        contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : '',
        fieldErrors,
        userMessage: typeof raw.userMessage === 'string' ? raw.userMessage : '',
    };
}

/** Translation keys for the "Detected" issue pills; mirrors Next.js exactly. */
export function moderationIssueTranslationKeys(warning: TextModerationWarning): string[] {
    const keys = new Set<string>();

    for (const issue of warning.issues) {
        if (issue === 'contact_social' || issue === 'social_handle' || issue === 'social_media_handle' || issue === 'off_platform') {
            keys.add('moderation_issue_social_handle');
        } else if (issue === 'contact_info' || issue === 'contact_details' || issue.startsWith('contact_')) {
            keys.add('moderation_issue_contact_info');
        } else if (issue === 'nsfw' || issue === 'spam_or_scam') {
            keys.add('moderation_issue_inappropriate');
        } else if (issue === 'racist_content' || issue === 'hate_speech') {
            keys.add('moderation_issue_racist');
        } else if (issue === 'violence_threat' || issue === 'harassment') {
            keys.add('moderation_issue_offensive');
        } else if (issue === 'unclear_company_name') {
            keys.add('moderation_issue_non_professional_company');
        }
    }

    if (warning.reasonCode === 'contact_details') keys.add('moderation_issue_contact_info');
    if (warning.reasonCode === 'unsafe_content') keys.add('moderation_issue_inappropriate');
    if (warning.reasonCode === 'spam') keys.add('moderation_issue_inappropriate');
    if (warning.reasonCode === 'unclear_or_non_professional_company_name') {
        keys.add('moderation_issue_non_professional_company');
    }

    if (!keys.size) keys.add('moderation_issue_needs_review');
    return [...keys];
}

/** Candidate text shown to the owner while a change awaits review. */
export function pendingModerationCandidate(meta: unknown): string {
    if (!meta || typeof meta !== 'object') return '';
    const record = meta as {
        moderationStatus?: unknown;
        candidateValue?: unknown;
        adminReview?: { status?: unknown };
    };
    if (record.moderationStatus !== 'pending_review') return '';
    if (record.adminReview?.status && record.adminReview.status !== 'pending') return '';
    return typeof record.candidateValue === 'string' ? record.candidateValue : '';
}

/** Candidate text the owner should continue editing (pending OR rejected). */
export function moderationCandidateForEditing(meta: unknown): string {
    if (!meta || typeof meta !== 'object') return '';
    const record = meta as { moderationStatus?: unknown; candidateValue?: unknown };
    if (!['pending_review', 'rejected'].includes(String(record.moderationStatus || ''))) {
        return '';
    }
    return typeof record.candidateValue === 'string' ? record.candidateValue : '';
}
