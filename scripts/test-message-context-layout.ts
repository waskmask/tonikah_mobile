import assert from 'node:assert/strict';
import { messageBubbleHolePath, messageContextLayout } from '../lib/messageContextLayout';

const viewport = { width: 375, height: 740 };
const received = messageContextLayout({ x: 24, y: 200, width: 200, height: 60 }, viewport, 184, 64, 48, false);
assert.equal(received.menu.x, 24);
assert.equal(received.reaction.x, 24);
assert.equal(received.menu.y, 268);
assert.equal(received.reaction.yIos + received.reaction.height, 192);
const sent = messageContextLayout({ x: 139, y: 200, width: 220, height: 60 }, viewport, 184, 64, 48, true);
assert.equal(sent.menu.x + sent.menu.width, 359);
assert.equal(sent.reaction.x + sent.reaction.width, 359);
assert.equal(sent.menu.y, 268);
for (const anchor of [
    { x: 12, y: 92, width: 180, height: 56 },
    { x: 160, y: 510, width: 200, height: 100 },
    { x: 20, y: 50, width: 330, height: 600 },
]) {
    const layout = messageContextLayout(anchor, viewport, 240, 64);
    assert.ok(layout.reaction.x >= 0 && layout.reaction.x + layout.reaction.width <= viewport.width);
    assert.ok(layout.reaction.yIos >= 0 && layout.reaction.yIos + layout.reaction.height <= viewport.height);
    assert.ok(layout.reaction.yAndroid >= 64 && layout.reaction.yAndroid + layout.reaction.height <= viewport.height);
    assert.ok(layout.menu.x >= 0 && layout.menu.x + layout.menu.width <= viewport.width);
    assert.ok(layout.menu.y >= 0 && layout.menu.y + layout.menu.height <= viewport.height);
}
const top = messageContextLayout({ x: 12, y: 92, width: 180, height: 56 }, viewport, 240, 64);
assert.ok(top.reaction.yIos < 92 && top.menu.y > 92 + 56);
const bottom = messageContextLayout({ x: 160, y: 510, width: 200, height: 100 }, viewport, 240, 64);
assert.ok(bottom.menu.y + bottom.menu.height < bottom.reaction.yIos);
const sentHole = messageBubbleHolePath({ x: 10, y: 20, width: 100, height: 60 }, true, 14);
const receivedHole = messageBubbleHolePath({ x: 10, y: 20, width: 100, height: 60 }, false, 14);
assert.ok(sentHole.includes('A 14 14 0 0 1 110 34'));
assert.ok(sentHole.includes('A 14 14 0 0 1 96 80'));
assert.ok(receivedHole.includes('A 14 14 0 0 1 96 80'));
assert.ok(receivedHole.includes('A 14 14 0 0 1 10 66'));
const sentTailHole = messageBubbleHolePath({ x: 10, y: 20, width: 100, height: 60 }, true, 14, { tail: true, tailWidth: 8 });
const receivedTailHole = messageBubbleHolePath({ x: 10, y: 20, width: 100, height: 60 }, false, 14, { tail: true, tailWidth: 8 });
assert.ok(sentTailHole.includes('V 68'));
assert.ok(sentTailHole.includes('110 78'));
assert.ok(receivedTailHole.includes('18 68'));
assert.ok(receivedTailHole.includes('10 78'));
assert.equal((sentTailHole.match(/M /g) || []).length, 1);
assert.equal((receivedTailHole.match(/M /g) || []).length, 1);
console.log('message context layout tests passed');
