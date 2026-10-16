export function resolvedLocation(value: unknown) {
    if (!value || typeof value !== 'object') return null;
    const place = value as Record<string, unknown>;
    const coordinate = (value: unknown) =>
        typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
    const lat = coordinate(place.lat);
    const lng = coordinate(place.lng);
    if (typeof place.place_id !== 'string' || !place.place_id.trim() ||
        typeof place.city !== 'string' || !place.city.trim() ||
        typeof place.countryCode !== 'string' || !/^[A-Z]{2}$/i.test(place.countryCode) ||
        !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return {
        place_id: place.place_id, city: place.city.trim(),
        ...(typeof place.state === 'string' && place.state.trim() ? { state: place.state.trim() } : {}),
        country: place.countryCode.toUpperCase(),
        geo: { type: 'Point' as const, coordinates: [lng, lat] },
    };
}

export async function resolveCachedOrCurrentPosition<T>(cached: () => Promise<T | null>, current: () => Promise<T>) {
    try {
        const position = await cached();
        if (position) return position;
    } catch {
        // A missing/broken last-known provider must not prevent a fresh GPS request.
    }
    return current();
}
