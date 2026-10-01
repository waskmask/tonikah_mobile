import { COUNTRY_TO_ISO, NATIONALITY_TO_ISO } from '@/constants/nationalityIso.generated';

function nationalityKey(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function nationalityValue(value: any) {
    if (value == null) return '';
    if (typeof value === 'object') {
        return String(value.label || value.name || value.value || value.country || '').trim();
    }
    return String(value).trim();
}

export function nationalityIso(value: any) {
    const raw = nationalityValue(value);
    if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
    const key = nationalityKey(raw) as keyof typeof NATIONALITY_TO_ISO;
    return NATIONALITY_TO_ISO[key] || '';
}

export function countryIso(value: any) {
    const raw = nationalityValue(value);
    if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
    const key = nationalityKey(raw) as keyof typeof COUNTRY_TO_ISO;
    return COUNTRY_TO_ISO[key] || '';
}

export function isoFlagEmoji(iso: string) {
    const code = String(iso || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return code
        .split('')
        .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
        .join('');
}

export function nationalityFlag(value: any) {
    return isoFlagEmoji(nationalityIso(value));
}

export function countryFlag(value: any) {
    return isoFlagEmoji(countryIso(value));
}

export function rawNationality(value: any) {
    return nationalityValue(value);
}
