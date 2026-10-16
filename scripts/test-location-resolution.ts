import assert from 'node:assert/strict';
import { apiFailureDetails } from '../lib/apiDiagnostics';
import { resolvedLocation, resolveCachedOrCurrentPosition } from '../lib/locationResolution';

async function main() {
    const place = { place_id: 'city-id', city: 'Berlin', countryCode: 'de', lat: 52.52, lng: 13.405 };
    assert.deepEqual(resolvedLocation(place), {
        place_id: 'city-id', city: 'Berlin', country: 'DE', geo: { type: 'Point', coordinates: [13.405, 52.52] },
    });
    for (const invalid of [null, {}, { ...place, lat: null }, { ...place, lat: '' }, { ...place, lng: 181 },
        { ...place, lat: 91 }, { ...place, city: ' ' }, { ...place, countryCode: 'Germany' }]) {
        assert.equal(resolvedLocation(invalid), null);
    }
    let calls = 0;
    const fresh = async () => { calls++; return 'fresh'; };
    assert.equal(await resolveCachedOrCurrentPosition(async () => 'cached', fresh), 'cached');
    assert.equal(calls, 0);
    assert.equal(await resolveCachedOrCurrentPosition(async () => null, fresh), 'fresh');
    assert.equal(await resolveCachedOrCurrentPosition(async () => { throw new Error('cache failure'); }, fresh), 'fresh');
    assert.equal(calls, 2);
    await assert.rejects(resolveCachedOrCurrentPosition(async () => null, async () => { throw new Error('gps unavailable'); }));

    const details = apiFailureDetails('/profile/places/reverse?lat=52.52&lng=13.405&token=secret', {
        status: 400, message: 'place_reverse_failed', meta: { status: 'REQUEST_DENIED' }, requestId: 'abc-123',
    }, 'https://devapi.tonikah.com/api');
    assert.equal(details.endpoint, '/profile/places/reverse');
    assert.equal(details.providerStatus, 'REQUEST_DENIED');
    assert.equal(details.host, 'devapi.tonikah.com');
    assert.equal(JSON.stringify(details).includes('secret'), false);
    assert.equal(JSON.stringify(details).includes('52.52'), false);
    assert.equal(apiFailureDetails('/test', { message: 'secret value with personal information' }, 'bad URL').message, 'unknown_error');
    console.log('Location resolution and safe API diagnostic tests passed.');
}
void main();
