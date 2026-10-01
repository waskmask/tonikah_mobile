import assert from 'node:assert/strict';
import { chatRelationship } from '../lib/chatRelationship';
import { waveformPeaks } from '../lib/chatWaveform';

assert.equal(chatRelationship({ status: 200, relationshipStatus: 'active', conversationId: 'chat-1' }), 'active');
assert.equal(chatRelationship({ status: 200, conversationId: 'chat-1' }), null);
assert.equal(chatRelationship({ status: 200, conversationId: 'chat-1' }, 'active'), 'active');
assert.equal(chatRelationship({ status: 200, conversationId: 'chat-1', requestRole: 'sent' }), 'pending');
assert.equal(chatRelationship({ status: 200, conversationId: null }), 'none');
assert.equal(chatRelationship({ status: 200, conversationId: 'chat-1' }, 'ended'), 'other');

const peaks = waveformPeaks([0, 0.2, 1, 0.2], 8);
assert.equal(peaks.length, 8);
assert.ok(Math.max(...peaks) >= 0.7);
assert.ok(peaks.every((value) => value >= 0.08 && value <= 1));

console.log('Chat relationship and waveform tests passed');
