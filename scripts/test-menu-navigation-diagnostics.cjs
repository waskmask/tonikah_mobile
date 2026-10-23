const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ dev = true, performanceClock = true } = {}) {
    let clock = 0;
    let nextFrame = 1;
    const frames = new Map();
    const logs = [];
    const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/menuNavigationDiagnostics.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const context = { exports: {}, __DEV__: dev,
        ...(performanceClock ? { performance: { now: () => clock } } : {}),
        Date: { now: () => clock },
        console: { log(line) {
            assert.ok(line.startsWith('[menu-navigation] '));
            logs.push(JSON.parse(line.slice('[menu-navigation] '.length)));
        } },
        requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelAnimationFrame(id) { frames.delete(id); },
    };
    vm.runInNewContext(compiled, context);
    const api = context.exports;
    return { ...api, logs, frames,
        tick: ms => { clock += ms; },
        frame() { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback()); },
        dispatch(destination = '/language') {
            const id = api.beginMenuNavigation(destination);
            api.markMenuNavigation(id, 'close_ready');
            api.markMenuNavigation(id, 'dispatch');
            return id;
        },
        listeners(name = 'language', key = `${name}-key`) { return api.menuNavigationScreenListeners({ route: { name, key } }); },
        stages: () => logs.map(mark => mark.stage),
        samples: () => JSON.parse(JSON.stringify(api.getMenuNavigationMeasurements())),
    };
}
const opening = { data: { closing: false } };
const closing = { data: { closing: true } };

test('full navigation logs numeric timings and honest double-frame milestones in event order', () => {
    const f = setup();
    const id = f.beginMenuNavigation('/language?returnTo=/private/account#secret');
    f.tick(12); f.markMenuNavigation(id, 'close_ready');
    f.tick(3); f.markMenuNavigation(id, 'dispatch');
    const screen = f.listeners();
    f.tick(4); screen.transitionStart(opening);
    f.tick(1); screen.focus();
    f.frame(); assert.ok(!f.stages().includes('focus_frame'));
    f.tick(16); f.frame();
    f.tick(30); screen.transitionEnd(opening);
    f.frame(); assert.ok(!f.stages().includes('settled_frame'));
    f.tick(16); f.frame();
    assert.deepEqual(f.stages(), ['tap', 'close_ready', 'dispatch', 'transition_start', 'focus', 'focus_frame', 'transition_end', 'settled_frame']);
    assert.ok(f.logs.every(mark => mark.id === id && mark.destination === '/language'));
    assert.deepEqual(f.logs.at(-1), { id, destination: '/language', stage: 'settled_frame', elapsedMs: 82, sinceCloseMs: 70, sinceDispatchMs: 67 });
    assert.equal(f.samples()[0].status, 'settled');
    assert.equal(f.frames.size, 0);
});

test('whitelist strips query data and rejects unknown destinations without logging', () => {
    const f = setup();
    for (const path of ['/profile', '/hobbies-faith', '/partner-preference', '/language', '/memberships', '/verifications', '/blocked-users', '/settings']) {
        assert.equal(typeof f.beginMenuNavigation(`${path}?email=private@example.com`), 'number');
    }
    for (const path of ['/users/secret', '//language', '/language/extra', 'https://private.example', '/search']) {
        assert.equal(f.beginMenuNavigation(path), undefined);
    }
    assert.equal(f.logs.length, 8);
    assert.ok(!JSON.stringify(f.logs).includes('private'));
});

test('production calls do not log, schedule frames, or collect navigation samples', () => {
    const f = setup({ dev: false });
    assert.equal(f.dispatch(), undefined);
    f.markMenuNavigation(1, 'dispatch'); f.cancelMenuNavigation(1);
    assert.deepEqual(Object.keys(f.listeners()), []);
    assert.deepEqual(f.samples(), []);
    assert.deepEqual(f.logs, []);
    assert.equal(f.frames.size, 0);
});

test('dispatch is required, ordered after close readiness, and duplicate marks/events are ignored', () => {
    const f = setup();
    const id = f.beginMenuNavigation('/language');
    const screen = f.listeners();
    screen.focus(); screen.transitionStart(opening); screen.transitionEnd(opening);
    f.markMenuNavigation(id, 'dispatch');
    assert.deepEqual(f.stages(), ['tap']);
    f.markMenuNavigation(id, 'close_ready'); f.tick(2); f.markMenuNavigation(id, 'close_ready');
    f.markMenuNavigation(id, 'dispatch'); f.markMenuNavigation(id, 'dispatch');
    screen.focus(); screen.focus(); screen.transitionStart(opening); screen.transitionStart(opening);
    screen.transitionEnd(opening); screen.transitionEnd(opening);
    f.frame(); f.frame();
    assert.equal(new Set(f.stages()).size, f.logs.length);
});

test('queued cancellation and undefined/stale ids cannot complete or cancel a newer sample', () => {
    const f = setup();
    const old = f.beginMenuNavigation('/language');
    f.cancelMenuNavigation(old);
    f.markMenuNavigation(old, 'close_ready');
    const id = f.dispatch('/settings');
    f.cancelMenuNavigation(old); f.cancelMenuNavigation(undefined); f.markMenuNavigation(undefined, 'dispatch');
    f.listeners('language').focus();
    f.listeners('settings').focus();
    assert.equal(f.logs.at(-1).id, id);
    assert.equal(f.logs.at(-1).stage, 'focus');
    assert.equal(f.samples()[0].status, 'canceled');
});

test('blur before either focus frame cancels completion and pending frame callbacks', () => {
    for (const frameCount of [0, 1]) {
        const f = setup(); f.dispatch();
        const screen = f.listeners(); screen.transitionStart(opening); screen.focus();
        if (frameCount) f.frame();
        screen.blur(); screen.transitionEnd(opening); f.frame(); f.frame();
        assert.ok(!f.stages().includes('focus_frame'));
        assert.ok(!f.stages().includes('settled_frame'));
        assert.equal(f.frames.size, 0);
        assert.equal(f.samples()[0].status, 'canceled');
    }
});

test('other/root routes, event targets, native closing transitions, and unmatched ends do not produce milestones', () => {
    const f = setup(); f.dispatch();
    const screen = f.listeners();
    f.listeners('(tabs)').focus(); f.listeners('settings').focus();
    screen.focus({ target: 'wrong-key' });
    screen.transitionStart(closing); screen.transitionEnd(closing);
    screen.transitionStart({}); screen.transitionEnd(opening);
    assert.deepEqual(f.stages(), ['tap', 'close_ready', 'dispatch']);
    screen.focus({ target: 'language-key' });
    f.listeners('language', 'different-key').transitionStart(opening);
    screen.transitionEnd(opening);
    assert.deepEqual(f.stages(), ['tap', 'close_ready', 'dispatch', 'focus']);
});

test('navigation replacement cancels old frames and ignores stale callbacks even for the same route', () => {
    const f = setup(); const oldId = f.dispatch();
    const old = f.listeners('language', 'old-key'); old.transitionStart(opening); old.focus();
    const oldFrame = [...f.frames.values()][0];
    const id = f.dispatch();
    assert.equal(f.frames.size, 0);
    old.transitionEnd(opening); old.blur();
    const next = f.listeners('language', 'new-key'); next.transitionStart(opening); next.focus();
    oldFrame(); old.transitionEnd(opening); old.blur();
    f.cancelMenuNavigation(oldId); f.markMenuNavigation(oldId, 'dispatch');
    next.transitionEnd(opening); f.frame(); f.frame();
    assert.equal(f.logs.filter(mark => mark.stage === 'settled_frame').length, 1);
    assert.equal(f.logs.at(-1).id, id);
    assert.deepEqual(f.samples().map(sample => sample.status), ['canceled', 'settled']);
});

test('same route listeners can correlate a new id after an earlier navigation was canceled', () => {
    const f = setup(); const screen = f.listeners();
    f.dispatch(); screen.transitionStart(opening); screen.focus(); screen.blur();
    const id = f.dispatch();
    screen.transitionEnd(opening);
    assert.ok(!f.stages().includes('transition_end'));
    screen.transitionStart(opening); screen.focus(); screen.transitionEnd(opening);
    f.frame(); f.frame();
    assert.equal(f.logs.at(-1).id, id);
    assert.equal(f.logs.at(-1).stage, 'settled_frame');
});

test('factory recreation between every native event preserves focus, transition, and settled measurements', () => {
    for (const focusFirst of [true, false]) {
        const f = setup(); const id = f.dispatch();
        if (focusFirst) {
            f.listeners().focus(); f.listeners().transitionStart(opening);
        } else {
            f.listeners().transitionStart(opening); f.listeners().focus();
        }
        f.frame(); f.frame();
        f.listeners().transitionEnd(opening);
        f.frame(); f.frame();
        assert.deepEqual(f.stages().slice(-3), ['focus_frame', 'transition_end', 'settled_frame']);
        assert.equal(f.logs.at(-1).id, id);
        assert.equal(f.samples()[0].status, 'settled');
    }
});

test('a recreated blur listener cancels focus readiness and prevents late completion', () => {
    const f = setup(); f.dispatch();
    f.listeners().transitionStart(opening); f.listeners().focus(); f.frame();
    f.listeners().blur(); f.listeners().transitionEnd(opening); f.frame(); f.frame();
    assert.equal(f.samples()[0].status, 'canceled');
    assert.equal(f.frames.size, 0);
    assert.ok(!f.stages().includes('focus_frame'));
    assert.ok(!f.stages().includes('settled_frame'));
});

test('recreated listeners cannot reuse a superseded sample lifecycle for a new same-route id', () => {
    const f = setup(); const oldId = f.dispatch();
    f.listeners().transitionStart(opening); f.listeners().focus();
    const id = f.dispatch();
    f.listeners().transitionEnd(opening); f.listeners().blur();
    f.frame(); f.frame();
    assert.ok(!f.logs.some(mark => mark.id === id && ['transition_end', 'settled_frame'].includes(mark.stage)));
    assert.equal(f.samples()[1].status, 'active');
    f.listeners().transitionStart(opening); f.listeners().focus();
    f.listeners('language', 'stale-other-key').transitionEnd(opening);
    f.listeners('language', 'stale-other-key').blur();
    f.cancelMenuNavigation(oldId);
    f.listeners().transitionEnd(opening); f.frame(); f.frame();
    assert.equal(f.logs.at(-1).id, id);
    assert.equal(f.logs.at(-1).stage, 'settled_frame');
});

test('memory is bounded to twenty samples and snapshots cannot mutate diagnostics', () => {
    const f = setup();
    for (let index = 0; index < 30; index++) f.dispatch();
    const samples = f.getMenuNavigationMeasurements();
    assert.equal(samples.length, 20);
    samples[0].measurements[0].destination = '/private';
    assert.equal(f.samples()[0].destination, '/language');
    assert.equal(f.samples()[0].measurements[0].destination, '/language');
});

test('active samples expire lazily after thirty seconds without timers or frame completion', () => {
    const f = setup(); const id = f.dispatch(); const screen = f.listeners(); screen.focus();
    f.tick(30_000); f.frame(); screen.transitionStart(opening); f.markMenuNavigation(id, 'close_ready');
    assert.equal(f.samples()[0].status, 'expired');
    assert.equal(f.frames.size, 0);
    assert.deepEqual(f.stages(), ['tap', 'close_ready', 'dispatch', 'focus']);
});

test('Date.now fallback supplies numerical elapsed timings', () => {
    const f = setup({ performanceClock: false }); const id = f.beginMenuNavigation('/profile');
    f.tick(7); f.markMenuNavigation(id, 'close_ready');
    assert.equal(f.logs.at(-1).elapsedMs, 7);
    assert.equal(f.logs.at(-1).sinceCloseMs, 0);
});
