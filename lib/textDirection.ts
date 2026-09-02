export type TextDirection = 'ltr' | 'rtl';

const RTL_LOCALES = new Set([
    'ar',
    'fa',
    'he',
    'ku',
    'ps',
    'sd',
    'ug',
    'ur',
    'yi',
]);
const LETTER_REGEX = new RegExp(String.fromCharCode(92) + 'p{L}', 'u');

function isRtlCodePoint(codePoint: number): boolean {
    return (
        (codePoint >= 0x0590 && codePoint <= 0x08ff) ||
        (codePoint >= 0xfb1d && codePoint <= 0xfdff) ||
        (codePoint >= 0xfe70 && codePoint <= 0xfeff) ||
        (codePoint >= 0x10d00 && codePoint <= 0x10d3f) ||
        (codePoint >= 0x10e80 && codePoint <= 0x10ebf) ||
        (codePoint >= 0x1e800 && codePoint <= 0x1e95f)
    );
}

export function localeTextDirection(locale?: string): TextDirection {
    const language = String(locale || '').toLowerCase().split(/[-_]/)[0];
    return RTL_LOCALES.has(language) ? 'rtl' : 'ltr';
}

export function getTextDirection(
    text: string | null | undefined,
    fallback: TextDirection = 'ltr',
): TextDirection {
    let rtlCount = 0;
    let ltrCount = 0;

    for (const character of String(text || '')) {
        if (!LETTER_REGEX.test(character)) continue;
        const codePoint = character.codePointAt(0);
        if (codePoint != null && isRtlCodePoint(codePoint)) {
            rtlCount += 1;
        } else if (character.toLocaleLowerCase() !== character.toLocaleUpperCase()) {
            ltrCount += 1;
        }
    }

    if (rtlCount === ltrCount) return fallback;
    return rtlCount > ltrCount ? 'rtl' : 'ltr';
}
