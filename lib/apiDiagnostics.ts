// Only machine-readable codes are logged. Never log bodies, credentials or query strings.
export function apiFailureDetails(endpoint: string, result: {
    status?: unknown; message?: unknown; requestId?: unknown; meta?: { status?: unknown };
}, apiUrl: string) {
    const code = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
    let host = 'unknown';
    try { host = new URL(apiUrl).host; } catch { /* Invalid configuration is reported without its contents. */ }
    return {
        host,
        endpoint: endpoint.split('?')[0].replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id'),
        status: typeof result.status === 'number' ? result.status : 0,
        message: code(result.message) || 'unknown_error',
        providerStatus: code(result.meta?.status),
        requestId: code(result.requestId),
    };
}
