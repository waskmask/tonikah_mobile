import i18n from '@/lib/i18n';

export function t(key: string, fallback?: string, options?: Record<string, any>) {
    const value = i18n.t(key, { defaultValue: fallback || key, ...options });
    return typeof value === 'string' ? value : fallback || key;
}

export function toKey(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function displayText(value?: any) {
    const raw = String(
        typeof value === 'object' && value !== null
            ? value.label || value.name || value.title || value.value || value.value_id || ''
            : value || '',
    ).trim();
    if (!raw) return '';
    const key = toKey(raw);
    if (i18n.exists(key)) return t(key, raw);
    return raw.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function titleCase(value: string) {
    return String(value || '')
        .replace(/_/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function translateCountry(value?: string | null) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    const upper = raw.toUpperCase();
    if (/^[a-z]{2}$/i.test(raw) && i18n.exists(`c_${lower}`, { ns: 'countries' })) {
        return titleCase(i18n.t(`c_${lower}`, { ns: 'countries' }));
    }
    if (i18n.exists(lower, { ns: 'countries' })) return titleCase(i18n.t(lower, { ns: 'countries' }));
    if (i18n.exists(upper, { ns: 'countries' })) return titleCase(i18n.t(upper, { ns: 'countries' }));
    return displayText(raw);
}

export function translateNamespace(ns: string, value?: string | null) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const key = toKey(raw);
    if (i18n.exists(key, { ns })) return i18n.t(key, { ns });
    if (i18n.exists(raw, { ns })) return i18n.t(raw, { ns });
    return displayText(raw);
}

export function selectLabel(value?: any) {
    const label = String(value?.label || value?.name || '').trim();
    if (!label) return '';
    if (/\d/.test(label)) return label;
    return displayText(label);
}

export function listText(values: Array<string | undefined | null>) {
    return values.filter((value): value is string => Boolean(value && value.trim())).join(', ');
}

export function calculateAge(dob?: string | Date) {
    if (!dob) return null;
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - date.getFullYear();
    const monthDiff = now.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age -= 1;
    return age >= 0 ? age : null;
}

export function cleanProfileText(value?: string | null) {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function cleanProfileMultilineText(value?: string | null) {
    return String(value || '')
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        // The API stores blank-line-separated paragraphs as adjacent <p>
        // elements. Preserve that paragraph boundary before stripping tags.
        .replace(/<\/\s*(p|div)\s*>\s*<\s*(p|div)(?:\s[^>]*)?>/gi, '\n\n')
        .replace(/<\/\s*(p|div|li)\s*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function locationText(location?: any) {
    if (!location) return '';
    const place = [location.city, location.state].filter(Boolean).join(', ');
    const country = translateCountry(location.country);
    return [place, country].filter(Boolean).join(' - ');
}

export function apiMessage(message?: string, fallback = 'something_went_wrong') {
    return t(message || fallback, t(fallback, 'Something went wrong.'));
}

/** Resolve a display URL from a profile card or gallery item (includes blur URLs for private galleries). */
export function profileImage(item?: any) {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    const fromUrls = item.urls
        ? item.urls.original || item.urls.small || item.urls.thumb || item.urls.blur || item.urls.avatar
        : '';
    return (
        item.image ||
        item.photo ||
        item.profile_image ||
        item.profile_photo ||
        item.avatar ||
        fromUrls ||
        item.url ||
        ''
    );
}

function firstImageUrl(...values: unknown[]) {
    const match = values.find((value) => typeof value === 'string' && value.trim());
    return typeof match === 'string' ? match.trim() : '';
}

/** Prefer bandwidth-appropriate variants for repeated list cards and avatars. */
export function profileListImage(item?: any) {
    if (!item || typeof item === 'string') return profileImage(item);
    return firstImageUrl(
        item.avatarSmallUrl,
        item.avatarThumbUrl,
        item.smallUrl,
        item.thumbUrl,
        item.urls?.small,
        item.urls?.thumb,
        item.urls?.blur,
        item.urls?.original,
        profileImage(item),
    );
}

export function profileAvatarImage(item?: any) {
    if (!item || typeof item === 'string') return profileImage(item);
    return firstImageUrl(
        item.avatarThumbUrl,
        item.thumbUrl,
        item.avatarSmallUrl,
        item.urls?.thumb,
        item.urls?.small,
        item.urls?.blur,
        item.avatarUrl,
        profileImage(item),
    );
}
