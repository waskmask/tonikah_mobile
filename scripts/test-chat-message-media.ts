import assert from 'node:assert/strict';
import type { ChatMessage } from '../lib/chatService';
import { mergeChatMessageMedia } from '../lib/chatMessageMedia';
import { waveformPeaks } from '../lib/chatWaveform';
import {
    claimChatAudioPlayback,
    createChatAudioPlaybackOwner,
    isChatAudioPlaybackOwner,
    releaseChatAudioPlayback,
    stopAllChatAudioPlayback,
    stopChatAudioPlaybackForMessage,
} from '../lib/chatAudioPlayback';

const base: ChatMessage = {
    id: 'message-1',
    conversationId: 'conversation-1',
    sender: 'user-1',
    type: 'voice',
    createdAt: '2026-10-01T00:00:00Z',
    media: { key: 'audio-1', url: 'https://example.test/audio-1', localUri: 'file:///audio-1', waveform: [0, 0.5, 1] },
};

const sameMedia = { ...base, media: { key: 'audio-1', url: 'https://example.test/audio-1' } };
assert.deepEqual(mergeChatMessageMedia(base, sameMedia).media, base.media);

const replaced = { ...base, media: { key: 'audio-2', url: 'https://example.test/audio-2' } };
assert.deepEqual(mergeChatMessageMedia(base, replaced).media, replaced.media);
assert.equal(mergeChatMessageMedia(base, { ...base, unsent: true, media: null }).media, null);
assert.equal(mergeChatMessageMedia({ ...base, unsent: true, media: null }, sameMedia).unsent, true);

assert.deepEqual(waveformPeaks([], 32), []);
assert.deepEqual(waveformPeaks([0, 0, 0, 0], 4), [0, 0, 0, 0]);
assert(waveformPeaks([0, 0.5, 1, 0], 4)[2] > waveformPeaks([0, 0.5, 1, 0], 4)[1]);

const first = createChatAudioPlaybackOwner('voice-message:first');
const second = createChatAudioPlaybackOwner('voice-message:second');
let firstPauseCount = 0;
let secondPauseCount = 0;
claimChatAudioPlayback(first, () => { firstPauseCount += 1; });
claimChatAudioPlayback(second, () => { secondPauseCount += 1; });
assert.equal(firstPauseCount, 1);
assert.equal(isChatAudioPlaybackOwner(first), false);
assert.equal(isChatAudioPlaybackOwner(second), true);
stopChatAudioPlaybackForMessage('first');
assert.equal(isChatAudioPlaybackOwner(second), true);
stopChatAudioPlaybackForMessage('second');
assert.equal(secondPauseCount, 1);
assert.equal(isChatAudioPlaybackOwner(second), false);
releaseChatAudioPlayback(first);
claimChatAudioPlayback(first, () => { firstPauseCount += 1; });
stopAllChatAudioPlayback();
assert.equal(firstPauseCount, 2);
assert.equal(isChatAudioPlaybackOwner(first), false);

console.log('chat media merge and waveform tests passed');
