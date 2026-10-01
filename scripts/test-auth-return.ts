import assert from 'node:assert/strict';
import { firstSearchParam, sanitizeAuthReturnPath } from '../lib/authReturn';

assert.equal(sanitizeAuthReturnPath('/messages'), '/(tabs)/messages');
assert.equal(sanitizeAuthReturnPath('/settings'), '/settings');
assert.equal(sanitizeAuthReturnPath('/blocked-users'), '/blocked-users');
assert.equal(sanitizeAuthReturnPath('/edit-profile'), '/edit-profile');
assert.equal(sanitizeAuthReturnPath('/hobbies-faith'), '/hobbies-faith');
assert.equal(sanitizeAuthReturnPath('/language'), '/language');
assert.equal(sanitizeAuthReturnPath('/memberships'), '/memberships');
assert.equal(sanitizeAuthReturnPath('/partner-preference'), '/partner-preference');
assert.equal(sanitizeAuthReturnPath('/conversation/507f1f77bcf86cd799439011'), '/conversation/507f1f77bcf86cd799439011');
assert.equal(sanitizeAuthReturnPath('/user/user_123'), '/user/user_123');
assert.equal(sanitizeAuthReturnPath('/settings-security'), '/settings-security');

assert.equal(sanitizeAuthReturnPath('https://example.com'), '');
assert.equal(sanitizeAuthReturnPath('//example.com'), '');
assert.equal(sanitizeAuthReturnPath('/(auth)/login'), '');
assert.equal(sanitizeAuthReturnPath('/(onboarding)'), '');
assert.equal(sanitizeAuthReturnPath('/(tabs)/settings'), '');
assert.equal(sanitizeAuthReturnPath('/(tabs)/favourited'), '');
assert.equal(sanitizeAuthReturnPath('/delete-account'), '');
assert.equal(sanitizeAuthReturnPath('/conversation/new'), '');
assert.equal(sanitizeAuthReturnPath('/conversation/id?next=https://example.com'), '');
assert.equal(sanitizeAuthReturnPath('/unknown', '/(tabs)/search'), '/(tabs)/search');

assert.equal(firstSearchParam(['first', 'second']), 'first');
assert.equal(firstSearchParam('single'), 'single');

console.log('auth return tests passed');
