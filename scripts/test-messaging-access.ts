import assert from 'node:assert/strict';
import {
    accessExpiresIn,
    canOpenMessaging,
    shouldRedactMessagingContent,
    withMessagingAccessClock,
    type MessagingAccess,
} from '../lib/messagingAccess';

const now = Date.parse('2026-09-07T12:00:00.000Z');
const base: MessagingAccess = {
    required: true,
    allowed: true,
    membershipActive: true,
    status: 'active',
    reason: null,
    validUntil: '2026-09-07T13:00:00.000Z',
    evaluatedAt: '2026-09-07T12:00:00.000Z',
};

assert.equal(canOpenMessaging(base, now), true);
assert.equal(canOpenMessaging({ ...base, allowed: false }, now), false);
assert.equal(canOpenMessaging({ ...base, membershipActive: false }, now), false);
assert.equal(canOpenMessaging({ ...base, validUntil: '2026-09-07T11:59:59.000Z' }, now), false);
assert.equal(canOpenMessaging({ ...base, required: false, allowed: true, membershipActive: false }, now), true);
assert.equal(accessExpiresIn(base, now), 60 * 60 * 1000);

const captured = withMessagingAccessClock(base, now);
assert.equal(canOpenMessaging(captured, now + 30 * 60 * 1000), true);
assert.equal(accessExpiresIn(captured, now + 30 * 60 * 1000), 30 * 60 * 1000);
assert.equal(canOpenMessaging(captured, now + 60 * 60 * 1000), false);
assert.equal(accessExpiresIn(captured, now + 60 * 60 * 1000), 0);

const localClockTwoHoursBehind = now - 2 * 60 * 60 * 1000;
const skewedClockAccess = withMessagingAccessClock(base, localClockTwoHoursBehind);
assert.equal(canOpenMessaging(skewedClockAccess, localClockTwoHoursBehind + 59 * 60 * 1000), true);
assert.equal(canOpenMessaging(skewedClockAccess, localClockTwoHoursBehind + 60 * 60 * 1000), false);

assert.equal(canOpenMessaging(base, now + 2 * 60 * 60 * 1000), false);

assert.equal(shouldRedactMessagingContent(undefined), true);
assert.equal(shouldRedactMessagingContent(base, true, now), true);
assert.equal(shouldRedactMessagingContent(base, false, now), false);
assert.equal(shouldRedactMessagingContent({ ...base, allowed: false }, false, now), true);
assert.equal(shouldRedactMessagingContent({ ...base, validUntil: '2026-09-07T11:59:59.000Z' }, false, now), true);
assert.equal(shouldRedactMessagingContent({ ...base, required: false, allowed: true, membershipActive: false }, false, now), false);

console.log('messaging access tests passed');
