export const MAX_INCOME = 10_000_000;
export const COMPANY_MAX = 50;
export const HEADLINE_MAX = 80;
export const BIO_MIN = 30;
export const BIO_MAX = 600;

const PROFILE_TEXT_REGEX = /^[\p{L}\p{M}\p{N}\s.,!?:;"'\u2018\u2019\u201c\u201d\-–—()\[\]&+/%\u060c\u061b\u061f\u2026]*$/u;
const PROFILE_LINK_REGEX = /(?:https?:\/\/|www\.|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.(?:com|net|org|io|co|de|uk|us|ca|au|in|pk|sa|ae|tr|fr|es|it|ru|id|pl|pt)\b)/iu;

const UNSAFE_CONTENT_TAGS =
    /<\s*(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BLOCK_END_TAGS =
    /<\s*\/\s*(p|div|section|article|blockquote|li|ul|ol|h[1-6])\s*>/gi;
const BLOCK_START_TAGS =
    /<\s*(p|div|section|article|blockquote|li|ul|ol|h[1-6])\b[^>]*>/gi;

export function decodeHtmlEntities(value: string) {
    return value
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
            const codePoint = Number.parseInt(hex, 16);
            return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : '';
        })
        .replace(/&#(\d+);/g, (_, num: string) => {
            const codePoint = Number.parseInt(num, 10);
            return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : '';
        });
}

/** Convert pasted HTML/Markdown styling to text without applying save-time whitespace trimming. */
export function plainTextFromFormattedInput(value: string) {
    let text = decodeHtmlEntities(normalizeProfileText(value));
    text = text
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(UNSAFE_CONTENT_TAGS, ' ')
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(BLOCK_END_TAGS, '\n\n')
        .replace(BLOCK_START_TAGS, '')
        .replace(/<[^>]*>/g, '');
    text = decodeHtmlEntities(text)
        .replace(UNSAFE_CONTENT_TAGS, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/(^|[\s([{])\*\*([^*\n]+)\*\*(?=$|[\s.,!?;:)\]}])/gm, '$1$2')
        .replace(/(^|[\s([{])__([^_\n]+)__(?=$|[\s.,!?;:)\]}])/gm, '$1$2')
        .replace(/(^|[\s([{])\*([^*\n]+)\*(?=$|[\s.,!?;:)\]}])/gm, '$1$2')
        .replace(/(^|[\s([{])_([^_\n]+)_(?=$|[\s.,!?;:)\]}])/gm, '$1$2')
        .replace(/`([^`\n]+)`/g, '$1')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b\u200c\u2060\ufeff]/g, '');
    return text;
}

export function cleanProfileTextForSave(value: string) {
    return plainTextFromFormattedInput(value)
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
