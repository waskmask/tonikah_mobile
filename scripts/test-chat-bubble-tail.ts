import assert from 'node:assert/strict';
import { coloredBubbleTailPath, imageBubbleTailPath } from '../lib/chatBubbleTail';

const sentImage = imageBubbleTailPath(200, 200, true);
const receivedImage = imageBubbleTailPath(200, 200, false);
assert.ok(sentImage.includes('V 188'));
assert.ok(sentImage.includes('200 198'));
assert.ok(receivedImage.includes('0 198'));
assert.ok(receivedImage.includes('M 22 0'));
assert.ok(coloredBubbleTailPath(true).includes('M 0 0'));
assert.ok(coloredBubbleTailPath(false).includes('M 8 0'));
for (const mine of [true, false]) {
    const path = imageBubbleTailPath(200, 80, mine, 14, 6);
    assert.equal((path.match(/M /g) || []).length, 1);
    assert.equal((path.match(/Z/g) || []).length, 1);
    assert.ok(path.includes('V 71') || path.includes('6 71'));
}

console.log('chat bubble tail geometry tests passed');
