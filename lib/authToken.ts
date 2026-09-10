const DEFAULT_EXPIRY_SKEW_MS = 30_000;

function decodeBase64Url(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return atob(padded);
}

export function getAccessTokenExpiryMs(token: string): number | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;

        const decoded = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
        return typeof decoded.exp === 'number' && Number.isFinite(decoded.exp)
            ? decoded.exp * 1000
            : null;
    } catch {
        return null;
    }
}

/**
 * This is only a startup timing hint. The API still verifies the token and is
 * the authority on revocation, signature validity, and session state.
 */
export function isAccessTokenUsable(
    token: string,
    nowMs = Date.now(),
    expirySkewMs = DEFAULT_EXPIRY_SKEW_MS,
): boolean {
    const expiryMs = getAccessTokenExpiryMs(token);
    return expiryMs !== null && expiryMs > nowMs + expirySkewMs;
}

export function canUseCachedUserAfterRefreshFailure(
    reason: 'unauthorized' | 'network_error' | undefined,
): boolean {
    return reason === 'network_error';
}
