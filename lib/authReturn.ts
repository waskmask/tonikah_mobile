const TAB_RETURN_PATHS = new Set([
    'activities',
    'blocked-users',
    'edit-profile',
    'favourited',
    'language',
    'memberships',
    'messages',
    'hobbies-faith',
    'partner-preference',
    'profile',
    'search',
    'settings',
]);

const ROOT_RETURN_PATHS = new Set([
    '/settings-account',
    '/settings-notifications',
    '/settings-privacy',
    '/settings-security',
    '/support',
]);

const DYNAMIC_RETURN_PATH = /^\/(conversation|user)\/([a-zA-Z0-9._~-]{1,128})$/;

export function sanitizeAuthReturnPath(
    value: string | null | undefined,
    fallback = '',
): string {
    if (!value || typeof value !== 'string') return fallback;

    const tabMatch = value.match(/^\/(?:\(tabs\)\/)?([a-z-]+)$/);
    if (tabMatch && TAB_RETURN_PATHS.has(tabMatch[1])) {
        return `/(tabs)/${tabMatch[1]}`;
    }

    if (ROOT_RETURN_PATHS.has(value)) return value;

    const dynamicMatch = value.match(DYNAMIC_RETURN_PATH);
    if (dynamicMatch && dynamicMatch[2] !== 'new') {
        return `/${dynamicMatch[1]}/${dynamicMatch[2]}`;
    }

    return fallback;
}

export function firstSearchParam(value?: string | string[]): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}
