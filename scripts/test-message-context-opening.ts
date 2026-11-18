import assert from 'node:assert/strict';
import { createMessageContextOpening, type MeasureMessageAnchor } from '../lib/messageContextOpening';

function fixture(ios = true) {
    let visible = false;
    let focused = false;
    let valid = true;
    const events: string[] = [];
    const listeners = new Set<() => void>();
    const frames = new Set<() => void>();
    const deadlines = new Set<() => void>();
    const opening = createMessageContextOpening({
        ios,
        keyboardVisible: () => visible,
        inputFocused: () => focused,
        dismissKeyboard: () => { events.push('dismiss'); focused = false; },
        onKeyboardHidden: (ready) => {
            events.push('subscribe');
            listeners.add(ready);
            return () => { listeners.delete(ready); };
        },
        nextFrame: (ready) => {
            frames.add(ready);
            return () => { frames.delete(ready); };
        },
        deadline: (ready) => {
            deadlines.add(ready);
            return () => { deadlines.delete(ready); };
        },
    });
    const measure: MeasureMessageAnchor = (ready) => {
        events.push('measure');
        ready({ x: 10, y: visible ? 200 : 400, width: 80, height: 40 });
    };
    return {
        opening, events, listeners, frames, deadlines,
        keyboard(value: boolean) { visible = value; focused = value; },
        focusOnly() { focused = true; },
        invalidate() { valid = false; },
        open(customMeasure = measure) {
            opening.open(customMeasure, (anchor) => events.push(`show:${anchor.y}`), () => valid);
        },
        hide() { visible = false; focused = false; [...listeners].forEach((ready) => ready()); },
        emitHideWithoutClosing() { [...listeners].forEach((ready) => ready()); },
        frame() { const pending = [...frames]; frames.clear(); pending.forEach((ready) => ready()); },
        timeout() { const pending = [...deadlines]; deadlines.clear(); pending.forEach((ready) => ready()); },
    };
}

{
    const f = fixture();
    f.open();
    assert.deepEqual(f.events, ['measure', 'show:400'], 'closed keyboard opens immediately');
    assert.equal(f.frames.size, 0);
    assert.equal(f.deadlines.size, 0);
}
{
    const f = fixture(false);
    f.keyboard(true);
    f.open();
    assert.deepEqual(f.events, ['measure', 'show:200'], 'Android does not dismiss or wait');
}
{
    const f = fixture();
    f.keyboard(true);
    f.open();
    assert.deepEqual(f.events, ['subscribe', 'dismiss'], 'subscribe before dismissal, no early measurement');
    f.hide();
    assert.equal(f.events.length, 2, 'wait for post-hide layout frame');
    f.frame();
    assert.deepEqual(f.events, ['subscribe', 'dismiss', 'measure', 'show:400']);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.deadlines.size, 0);
    f.hide();
    f.frame();
    assert.equal(f.events.filter((event) => event.startsWith('show')).length, 1);
}
{
    const f = fixture();
    f.focusOnly();
    f.open();
    f.frame();
    assert.deepEqual(f.events, ['subscribe', 'dismiss', 'measure', 'show:400'], 'hardware keyboard focus is blurred without timeout');
}
{
    const f = fixture();
    f.keyboard(true);
    f.open();
    f.emitHideWithoutClosing();
    f.frame();
    f.timeout();
    f.frame();
    assert.equal(f.events.includes('measure'), false, 'never opens over a still-visible keyboard');
    assert.equal(f.listeners.size, 0);
}
{
    const f = fixture();
    f.keyboard(true);
    f.open();
    f.open();
    f.hide();
    f.frame();
    assert.equal(f.events.filter((event) => event.startsWith('show')).length, 1, 'latest long press wins');
}
for (const cancel of [true, false]) {
    const f = fixture();
    f.keyboard(true);
    f.open();
    if (cancel) f.opening.cancel();
    else f.invalidate();
    f.hide();
    f.frame();
    f.timeout();
    assert.equal(f.events.includes('measure'), false, 'cancelled/removed message cannot open');
}
{
    const f = fixture();
    let finish: ((anchor: { x: number; y: number; width: number; height: number }) => void) | undefined;
    f.open((ready) => { finish = ready; });
    f.opening.cancel();
    finish?.({ x: 0, y: 0, width: 10, height: 10 });
    assert.deepEqual(f.events, [], 'late native measurement ignored after unmount/navigation');
}
{
    const f = fixture();
    f.keyboard(true);
    f.open();
    f.hide();
    f.keyboard(true);
    f.frame();
    f.timeout();
    assert.equal(f.events.includes('measure'), false, 'fresh keyboard opening cancels unsafe presentation');
}
{
    const f = fixture();
    f.keyboard(true);
    f.open();
    f.keyboard(false);
    f.timeout();
    f.frame();
    assert.equal(f.events.at(-1), 'show:400', 'missing event fallback rechecks actual hidden state');
    assert.equal(f.listeners.size, 0);
}
{
    const f = fixture();
    f.open((ready) => ready({ x: 0, y: 0, width: 0, height: 0 }));
    assert.deepEqual(f.events, [], 'unmounted/zero-size bubble cannot open');
}

console.log('Message context opening checks passed (iOS sequencing, Android, immediate opening, cancellation, keyboard/focus races, cleanup).');
