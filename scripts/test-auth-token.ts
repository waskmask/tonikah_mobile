import assert from 'node:assert/strict';
import {
    canUseCachedUserAfterRefreshFailure,
    getAccessTokenExpiryMs,
    isAccessTokenUsable,
} from '../lib/authToken';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = (payload: object) => `${encode({ alg: 'none' })}.${encode(payload)}.`;
const now = Date.parse('2026-09-09T12:00:00.000Z');

assert.equal(getAccessTokenExpiryMs(token({ exp: now / 1000 + 120 })), now + 120_000);
assert.equal(isAccessTokenUsable(token({ exp: now / 1000 + 120 }), now), true);
assert.equal(isAccessTokenUsable(token({ exp: now / 1000 + 20 }), now), false);
assert.equal(isAccessTokenUsable(token({ exp: now / 1000 - 1 }), now), false);
assert.equal(isAccessTokenUsable(token({ sub: 'user' }), now), false);
assert.equal(isAccessTokenUsable('not-a-jwt', now), false);
assert.equal(canUseCachedUserAfterRefreshFailure('network_error'), true);
assert.equal(canUseCachedUserAfterRefreshFailure('unauthorized'), false);
assert.equal(canUseCachedUserAfterRefreshFailure(undefined), false);

console.log('auth token tests passed');
