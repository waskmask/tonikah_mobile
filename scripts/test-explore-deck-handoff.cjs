const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the component's real handlers with deterministic animation/commit
// boundaries. Native image continuity still requires device verification.
function fixture(reducedMotion = false) {
    const slots = [];
    let cursor = 0;
    let effects = [];
    const animations = [];
    const calls = [];
    const handle = { current: null };
    let props = {
        profiles: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
        onPressCard: () => calls.push('open'),
        onSwiped: (direction) => calls.push(direction),
    };
    const slot = (init) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = init();
        return [slots[index], index];
    };
    const react = {
        forwardRef: (fn) => fn,
        useRef: (value) => slot(() => ({ current: value }))[0],
        useMemo: (fn) => fn(),
        useState: (value) => {
            const [stored, index] = slot(() => value);
            return [stored, (next) => { slots[index] = next; }];
        },
        useLayoutEffect: (fn, deps) => {
            const [previous, index] = slot(() => null);
            if (!previous || deps.some((value, i) => value !== previous[i])) {
                slots[index] = deps;
                effects.push(fn);
            }
        },
        useImperativeHandle: (ref, fn) => { ref.current = fn(); },
    };
    const jsx = (type, props, key) => ({ type, props: props || {}, key });
    const animated = {
        __esModule: true,
        default: { View: 'AnimatedView' },
        useSharedValue: (value) => slot(() => ({ value }))[0],
        useAnimatedStyle: (read) => ({ read }),
        runOnJS: (fn) => fn,
        runOnUI: (fn) => fn,
        cancelAnimation: () => {},
        withTiming: (value, _config, callback) => {
            if (callback) animations.push(callback);
            return value;
        },
        withSpring: (value, _config, callback) => {
            if (callback) animations.push(callback);
            return value;
        },
        interpolate: (value, input, output) => {
            const t = (value - input[0]) / (input.at(-1) - input[0]);
            return output[0] + t * (output.at(-1) - output[0]);
        },
        Extrapolation: { CLAMP: 'clamp' },
        Easing: { out: (value) => value, cubic: (value) => value },
    };
    const dependencies = {
        react,
        'react/jsx-runtime': { jsx, jsxs: jsx },
        'react-native': {
            Dimensions: { get: () => ({ width: 400 }) },
            StyleSheet: { create: (value) => value, absoluteFill: {} },
            View: 'View',
        },
        'react-native-reanimated': animated,
        'phosphor-react-native': { ArrowFatUp: 'Arrow' },
        './ExploreDeckCard': { ExploreDeckCard: 'ExploreDeckCard' },
        './ExploreActionBar': { ExploreSharpX: 'X' },
        '@/hooks/useResponsive': { scale: (value) => value },
        '@/hooks/useColors': { useColors: () => ({ chrome: { primary: 'pink', common: { iconNeutral: 'black' } } }) },
        '@/hooks/useReducedMotion': { useReducedMotion: () => reducedMotion },
        '@/lib/exploreProfile': { profileId: (profile) => profile.id },
    };
    const source = fs.readFileSync(path.join(__dirname, '../components/explore/SwipeableDeck.tsx'), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(compiled, {
        module, exports: module.exports,
        require: (name) => {
            assert.ok(name in dependencies, `Unexpected dependency ${name}`);
            return dependencies[name];
        },
    });
    return {
        calls, handle,
        render(patch = {}, commit = true) {
            props = { ...props, ...patch };
            cursor = 0;
            effects = [];
            const tree = module.exports.SwipeableDeck(props, handle);
            if (commit) this.commit();
            return tree?.props.children || [];
        },
        commit() { const pending = effects; effects = []; pending.forEach((fn) => fn()); },
        completeStep() { const pending = animations.splice(0); pending.forEach((fn) => fn(true)); return pending; },
        complete() {
            const completed = [];
            for (let i = 0; animations.length && i < 10; i++) completed.push(...this.completeStep());
            assert.equal(animations.length, 0);
            return completed;
        },
        layer(element) { return element.type(element.props); },
    };
}

function transform(layer) {
    return layer.props.style.at(-1).read().transform;
}

{
    const f = fixture();
    const before = f.render();
    f.handle.current.swipe('left');
    assert.equal(transform(f.layer(before[0]))[0].translateX, 0, 'X feedback starts before card exit');
    const badge = f.layer(before[0]).props.children[2];
    assert.equal(badge.props.style.at(-1).read().opacity, 1);
    assert.equal(f.layer(before[1]).props.children[2].props.style.at(-1).read().opacity, 0, 'underlay badge is never visible');
    f.completeStep();
    assert.equal(transform(f.layer(before[0]))[0].translateX, -560, 'feedback completion starts native exit');
    assert.deepEqual(f.calls, [], 'deck advances only after exit');
    f.complete();
    const after = f.render({ profiles: [{ id: 'B' }, { id: 'C' }] }, false);
    assert.equal(f.layer(after[0]).props.children[2].props.style.at(-1).read().opacity, 0,
        'new card cannot inherit old badge before layout commit');
    f.commit();
    assert.equal(f.layer(after[0]).props.children[2].props.style.at(-1).read().opacity, 0,
        'new card badge remains hidden after commit');
}

for (const direction of ['left', 'right']) {
    const f = fixture();
    const before = f.render();
    const underBefore = f.layer(before[1]);
    f.handle.current.swipe(direction);
    f.handle.current.swipe(direction);
    const callbacks = f.complete();
    assert.deepEqual(f.calls, [direction], 'one completion per exit');
    callbacks.forEach((fn) => fn(true));
    assert.deepEqual(f.calls, [direction], 'duplicate completion ignored');
    assert.equal(Math.abs(transform(f.layer(before[0]))[0].translateX), 560, 'outgoing stays offscreen');
    assert.equal(transform(underBefore).at(-1).scale, 1, 'next card stays full size');
    f.handle.current.swipe(direction);
    f.complete();
    assert.equal(f.calls.length, 1, 'locked until parent commit');
    const after = f.render({ profiles: [{ id: 'B' }, { id: 'C' }] }, false);
    assert.equal(before[1].key, after[0].key, 'promoted profile retains React key');
    assert.equal(before[1].type, after[0].type, 'promoted profile retains component type');
    assert.equal(transform(f.layer(after[0]))[0].translateX, 0, 'incoming ignores outgoing transform');
    f.commit();
    assert.equal(transform(f.layer(after[0])).at(-1).scale, 1);
    assert.equal(transform(f.layer(after[1])).at(-1).scale, 0.95);
    f.render();
    f.handle.current.swipe('left');
    f.complete();
    assert.equal(f.calls.length, 2, 'next action enabled after commit');
}

{
    const f = fixture();
    f.render();
    f.handle.current.swipe('left');
    f.render({ profiles: [{ id: 'X' }, { id: 'Y' }] });
    f.complete();
    assert.deepEqual(f.calls, [], 'stale completion cannot skip a replacement profile');
    f.handle.current.prepareRestore('left');
    const restored = f.render({ profiles: [{ id: 'A' }, { id: 'X' }] });
    f.complete();
    assert.equal(transform(f.layer(restored[0]))[0].translateX, 0, 'Undo ends centered');
    f.handle.current.swipe('right');
    f.complete();
    assert.deepEqual(f.calls, ['right'], 'Undo releases input lock');
}

{
    const f = fixture(true);
    const before = f.render();
    f.handle.current.swipe('left');
    assert.deepEqual(f.calls, ['left']);
    assert.equal(transform(f.layer(before[0]))[0].translateX, -560);
    assert.equal(f.render({ profiles: [] }).length, 0, 'empty deck is safe');
}

{
    const f = fixture();
    const before = f.render();
    const layer = f.layer(before[0]);
    assert.equal(layer.props.pointerEvents, 'auto');
    assert.equal(f.layer(before[1]).props.pointerEvents, 'none');
    const event = (x, y) => ({ nativeEvent: { pageX: x, pageY: y } });
    for (const [x, y] of [[-180, 0], [180, 0], [0, -180], [0, 180], [80, 80]]) {
        assert.equal(layer.props.onStartShouldSetResponderCapture(event(200, 300)), false, 'allow intentional press');
        assert.equal(layer.props.onMoveShouldSetResponderCapture(event(202, 302)), false, 'allow minor finger movement');
        assert.equal(layer.props.onMoveShouldSetResponderCapture(event(200 + x, 300 + y)), true,
            'parent takes responder to cancel the nested card press on drag');
        assert.equal(transform(layer)[0].translateX, 0, 'drag never translates card');
        assert.equal(transform(layer)[1].translateY, 0);
    }
    assert.deepEqual(f.calls, [], 'no swipe navigation/save/skip callbacks');
    const card = layer.props.children[0];
    card.props.onPress();
    assert.deepEqual(f.calls, ['open'], 'intentional/accessibility press still opens profile');
    f.handle.current.swipe('left');
    card.props.onPress();
    assert.deepEqual(f.calls, ['open'], 'ignore profile presses during button exit');
    f.complete();
    assert.deepEqual(f.calls, ['open', 'left']);
}

{
    const f = fixture();
    f.render();
    f.handle.current.swipe('left');
    f.complete();
    f.render({ profiles: [{ id: 'B' }, { id: 'C' }] });
    f.handle.current.prepareRestore('left');
    const restored = f.render({ profiles: [{ id: 'A' }, { id: 'B' }] });
    f.complete();
    assert.equal(transform(f.layer(restored[1])).at(-1).scale, 0.95, 'Undo clears previous promotion pin');
}

const deckSource = fs.readFileSync(path.join(__dirname, '../components/explore/SwipeableDeck.tsx'), 'utf8');
assert.equal(/GestureDetector|Gesture\.Pan|velocityX|velocityY|releaseSwipe/.test(deckSource), false,
    'no deck pan/fling recognition remains');
const searchSource = fs.readFileSync(path.join(__dirname, '../app/(tabs)/(main)/search.tsx'), 'utf8');
const searchAst = ts.createSourceFile('search.tsx', searchSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visit(node) {
    if (ts.isVariableDeclaration(node) && ['skip', 'favorite', 'canSwipe'].includes(node.name.getText(searchAst))) {
        handlers[node.name.getText(searchAst)] = node.initializer.getText(searchAst);
    }
    ts.forEachChild(node, visit);
}
visit(searchAst);
for (const [name, direction] of [['skip', 'left'], ['favorite', 'right']]) {
    let allowed = false;
    const calls = [];
    const handler = vm.runInNewContext(`(${handlers[name]})`, {
        current: { id: 'A' }, currentId: 'A',
        canSwipe: () => allowed,
        deckRef: { current: { swipe: (direction) => calls.push(direction) } },
    });
    handler();
    assert.deepEqual(calls, [], `${name} retains its parent gate`);
    allowed = true;
    handler();
    assert.deepEqual(calls, [direction]);
}
console.log('Explore deck checks passed (button gates/exits, identity, locking, stale completion, Undo, tap/drag boundary, reduced motion, empty deck).');
