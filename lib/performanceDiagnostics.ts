type RequestCounts = Record<string, number>;

const interactionStarts = new Map<string, number>();
const requestCounts: RequestCounts = {};

function now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function normalizedEndpoint(endpoint: string) {
    return endpoint
        .split('?')[0]
        .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:id')
        .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id');
}

export function markInteraction(name: string) {
    if (!__DEV__) return;
    interactionStarts.set(name, now());
}

export function completeInteraction(name: string, milestone: string) {
    if (!__DEV__) return;
    const startedAt = interactionStarts.get(name);
    if (startedAt === undefined) return;
    interactionStarts.delete(name);
    console.debug(`[performance] ${name}:${milestone} ${Math.round(now() - startedAt)}ms`);
}

export function recordApiRequest(endpoint: string) {
    if (!__DEV__) return;
    const key = normalizedEndpoint(endpoint);
    requestCounts[key] = (requestCounts[key] || 0) + 1;
}

export function getApiRequestCounts(): RequestCounts {
    return { ...requestCounts };
}

export function resetApiRequestCounts() {
    Object.keys(requestCounts).forEach((key) => delete requestCounts[key]);
}
