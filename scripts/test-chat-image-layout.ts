import assert from 'node:assert/strict';
import { chatImageLayout } from '../lib/chatImageLayout';

assert.deepEqual(chatImageLayout(1000, 1000, 300), { width: 234, height: 234, crop: false });
assert.deepEqual(chatImageLayout(1600, 900, 300), { width: 234, height: 131.625, crop: false });
assert.deepEqual(chatImageLayout(500, 1000, 300), { width: 180, height: 240, crop: true });
assert.deepEqual(chatImageLayout(500, 1500, 300), { width: 180, height: 240, crop: true });
assert.deepEqual(chatImageLayout(undefined, undefined, 300), { width: 234, height: 234, crop: false });

console.log('chat image layout tests passed');
