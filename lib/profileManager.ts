import { t } from './profileDisplay';

const SELF_MANAGED_VALUES = new Set(['self', 'myself', 'me']);

const MANAGER_FALLBACKS: Record<string, string> = {
    father: 'Father',
    mother: 'Mother',
    brother: 'Brother',
    sister: 'Sister',
    relative: 'Relative',
    friend: 'Friend',
};

export function normalizeProfileManager(value?: string | null): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/** Translated manager label ("Father", …) or null when the profile is self-managed. */
export function formatProfileManagerBadge(value?: string | null): string | null {
    const key = normalizeProfileManager(value);
    if (!key || SELF_MANAGED_VALUES.has(key)) return null;
    return t(key, MANAGER_FALLBACKS[key] ?? titleCase(key));
}

function titleCase(value: string): string {
    return value
        .replace(/_/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
