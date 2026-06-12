export const MAX_INCOME = 10_000_000;
export const COMPANY_MAX = 30;
export const HEADLINE_MAX = 80;
export const BIO_MAX = 600;

const PROFILE_TEXT_REGEX = /^[\p{L}\p{M}\p{N}\s.,!?:;"'\u2018\u2019\u201c\u201d\-–—()\[\]&+/%\u060c\u061b\u061f\u2026]*$/u;
const PROFILE_LINK_REGEX = /(?:https?:\/\/|www\.|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.(?:com|net|org|io|co|de|uk|us|ca|au|in|pk|sa|ae|tr|fr|es|it|ru|id|pl|pt)\b)/iu;

export function cleanProfileTextForSave(value: string) {
    return normalizeProfileText(value)
        .split('\n')
        .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
        .join('\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function cleanHeadlineTextForSave(value: string) {
    return cleanProfileTextForSave(value).replace(/\s*\n+\s*/g, ' ').trim();
}

export function normalizeProfileText(value: string) {
    return value.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
}

export function countNonSpace(value: string) {
    return value.replace(/\s/g, '').length;
}

export function trimToNonSpaceLimit(value: string, limit: number) {
    let count = 0;
    let output = '';

    for (const char of value) {
        if (/\s/.test(char)) {
            output += char;
            continue;
        }

        if (count >= limit) break;
        output += char;
        count += 1;
    }

    return output;
}

export function isAllowedProfileText(value: string) {
    const normalized = normalizeProfileText(value).normalize('NFC');
    return PROFILE_TEXT_REGEX.test(normalized) && !PROFILE_LINK_REGEX.test(normalized);
}

export function formatAmount(value: string) {
    const digits = String(value || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('en-US');
}

export function parseAmount(value: string) {
    const digits = String(value || '').replace(/[^\d]/g, '');
    if (!digits) return Number.NaN;
    return Number(digits);
}
