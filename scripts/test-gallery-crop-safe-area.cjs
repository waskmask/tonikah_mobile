const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/app/GalleryCropModal.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
const plain = value => JSON.parse(JSON.stringify(value));
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function pathTo(node, predicate, ancestors = []) {
    if (Array.isArray(node)) {
        for (const child of node) { const result = pathTo(child, predicate, ancestors); if (result) return result; }
    } else if (node && typeof node === 'object') {
        if (predicate(node)) return [...ancestors, node];
        return pathTo(node.props?.children, predicate, [...ancestors, node]);
    }
    return null;
}

function setup({ os = 'ios', isRTL = false, isDark = false, insets = { top: 59, bottom: 34, left: 0, right: 0 }, ...overrides } = {}) {
    const hooks = [];
    const effects = [];
    const frames = new Map();
    let cursor = 0;
    let dirty = false;
    let nextFrame = 1;
    let tree;
    const state = { closes: 0, uploads: [], errors: [], manipulations: [], manipulate: async () => ({ uri: 'file:///cropped.jpg' }) };
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
    const mockReact = {
        ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
            return [hooks[index], value => {
                const next = typeof value === 'function' ? value(hooks[index]) : value;
                if (!Object.is(next, hooks[index])) { hooks[index] = next; dirty = true; }
            }];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = { current: initial };
            return hooks[index];
        },
        useMemo(factory, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) hooks[index] = { deps, value: factory() };
            return hooks[index].value;
        },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) effects.push(() => {
                hooks[index]?.cleanup?.();
                hooks[index] = { deps, cleanup: effect() };
            });
        },
    };
    const context = {
        exports: {},
        requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        require(name) {
            if (name === 'react') return mockReact;
            if (name === 'react/jsx-runtime') return require(name);
            if (name === 'react-native') return {
                View: 'View', Modal: 'Modal', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
                ScrollView: 'ScrollView', StatusBar: 'StatusBar', Platform: { OS: os },
                Image: { getSize: (_uri, onLoad) => onLoad(1200, 1600) },
                StyleSheet: { create: value => value, absoluteFill: {} },
                PanResponder: { create: handlers => ({ panHandlers: handlers }) },
            };
            if (name === 'react-native-safe-area-context') return {
                SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'NativeSafeAreaView',
                initialWindowMetrics: { insets, frame: { x: 0, y: 0, width: 390, height: 844 } },
                useSafeAreaInsets() { assert.fail('Crop modal must not read insets from its parent screen context'); },
            };
            if (name === 'expo-image') return { Image: 'Image' };
            if (name === 'expo-image-manipulator') return {
                SaveFormat: { JPEG: 'jpeg' },
                manipulateAsync: async (...args) => { state.manipulations.push(args); return state.manipulate(...args); },
            };
            if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL }) };
            if (name === '@/hooks/useResponsive') return { scale: value => value };
            if (name === '@/components/ui/icons/PhosphorCompat') return { RotateCw: 'RotateCw' };
            if (name === 'phosphor-react-native') return { CaretLeft: 'CaretLeft', CaretRight: 'CaretRight' };
            if (name === '@/components/ui/Text') return { Text: 'Text' };
            if (name === '@/components/ui/GradientButton') return { GradientButton: 'GradientButton' };
            throw new Error(`Unexpected import: ${name}`);
        },
    };
    vm.runInNewContext(compiled, context, { filename: 'GalleryCropModal.tsx' });
    const props = {
        visible: true, imageUri: 'file:///source.jpg', sourceSize: { width: 1200, height: 1600 }, isDark, uploading: false,
        labels: { title: 'Adjust photo', subtitle: 'Frame photo', preparing: 'Preparing', upload: 'Upload', rotate: 'Rotate' },
        onClose: () => { state.closes++; }, onUpload: async uri => { state.uploads.push(uri); }, onError: message => state.errors.push(message),
        ...overrides,
    };
    const render = changes => {
        Object.assign(props, changes);
        let passes = 0;
        do {
            assert.ok(passes++ < 25, 'Crop effects must settle');
            dirty = false; cursor = 0;
            tree = context.exports.GalleryCropModal(props);
            while (effects.length) effects.shift()();
        } while (dirty);
        return tree;
    };
    const nodes = () => descendants(tree);
    const find = type => nodes().find(node => node.type === type);
    const frame = () => nodes().find(node => node.type === 'View' && node.props.onLayout && node.props.onPanResponderGrant && !node.props.onStartShouldSetPanResponderCapture);
    render();
    return {
        state, props, render, nodes, find, frame,
        path: predicate => pathTo(tree, predicate),
        layoutFrame(width = 300, height = 400) {
            frame().props.onLayout({ nativeEvent: { layout: { width, height } } }); render();
        },
        unmount() { for (const hook of hooks) hook?.cleanup?.(); },
    };
}

// These scenarios check emitted native props and ancestry, not actual OS inset measurements.
const scenarios = [
    { name: 'iOS notch portrait', os: 'ios', insets: { top: 59, bottom: 34, left: 0, right: 0 } },
    { name: 'iOS notch landscape', os: 'ios', insets: { top: 0, bottom: 21, left: 59, right: 59 } },
    { name: 'Android edge-to-edge', os: 'android', insets: { top: 24, bottom: 24, left: 0, right: 0 } },
    { name: 'Android landscape no bottom inset', os: 'android', insets: { top: 0, bottom: 0, left: 28, right: 0 } },
];
for (const scenario of scenarios) {
    for (const isRTL of [false, true]) {
        test(`${scenario.name}, RTL=${isRTL}: modal-local provider and native edge props isolate header/footer safe areas`, () => {
            const f = setup({ ...scenario, isRTL });
            const modal = f.find('Modal');
            assert.equal(modal.props.presentationStyle, 'fullScreen');
            assert.equal(modal.props.transparent, false);
            assert.equal(modal.props.statusBarTranslucent, true);
            assert.equal(modal.props.navigationBarTranslucent, true);
            const provider = f.find('SafeAreaProvider');
            assert.ok(provider);
            assert.equal(f.nodes().filter(node => node.type === 'SafeAreaProvider').length, 1);
            assert.equal(modal.props.children, provider);
            assert.equal(flatten(provider.props.style).flex, 1);
            assert.equal(provider.props.initialMetrics, undefined, 'Do not freeze the modal to parent window metrics');
            const safeAreas = f.nodes().filter(node => node.type === 'NativeSafeAreaView');
            assert.equal(safeAreas.length, 2);
            const main = safeAreas.find(node => Array.isArray(node.props.edges));
            const footer = safeAreas.find(node => !Array.isArray(node.props.edges));
            assert.deepEqual([...main.props.edges].sort(), ['left', 'right', 'top']);
            assert.equal(flatten(main.props.style).flex, 1);
            assert.deepEqual(plain(footer.props.edges), { bottom: 'maximum' });
            assert.equal(flatten(footer.props.style).paddingBottom, 14);
            const path = f.path(node => node === footer);
            assert.ok(path.indexOf(provider) > path.indexOf(modal));
            assert.ok(path.indexOf(main) > path.indexOf(provider));
            assert.ok(path.indexOf(footer) > path.indexOf(main));
            assert.ok(descendants(footer).some(node => node.type === 'GradientButton'));
            assert.equal(f.nodes().some(node => node.type === (isRTL ? 'CaretRight' : 'CaretLeft')), true);
            const back = f.nodes().find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Adjust photo');
            assert.ok(back);
            const backPath = f.path(node => node === back);
            const backWrapper = backPath.at(-2);
            const header = backPath.at(-3);
            assert.equal(flatten(backWrapper.props.style).start, 12);
            assert.equal(flatten(header.props.style).direction, isRTL ? 'rtl' : 'ltr');
            const buttonStyle = flatten(back.props.style({ pressed: false }));
            assert.equal(buttonStyle.width, 44);
            assert.equal(buttonStyle.height, 44);
            const slider = f.nodes().find(node => node.props?.onStartShouldSetPanResponderCapture);
            assert.ok(slider);
            const controls = f.path(node => node === slider).at(-2);
            assert.equal(flatten(controls.props.style).direction, 'ltr');
        });
    }
}

test('theme and visibility props survive the modal-local provider', () => {
    const f = setup({ isDark: true });
    assert.equal(flatten(f.find('SafeAreaProvider').props.style).backgroundColor, '#101011');
    assert.equal(f.find('StatusBar').props.barStyle, 'light-content');
    f.render({ visible: false });
    assert.equal(f.find('Modal').props.visible, false);
    f.render({ visible: true, isDark: false });
    assert.equal(f.find('StatusBar').props.barStyle, 'dark-content');
    assert.equal(flatten(f.find('SafeAreaProvider').props.style).backgroundColor, '#FFFFFF');
});

test('idle close works but uploading disables native back, header close, rotate and gestures', () => {
    const f = setup(); f.layoutFrame();
    f.find('Modal').props.onRequestClose();
    assert.equal(f.state.closes, 1);
    const back = () => f.nodes().find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Adjust photo');
    back().props.onPress();
    assert.equal(f.state.closes, 2);
    f.render({ uploading: true });
    assert.equal(f.find('Modal').props.onRequestClose, undefined);
    assert.equal(back().props.disabled, true);
    assert.equal(f.nodes().find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Rotate').props.disabled, true);
    assert.equal(f.find('GradientButton').props.disabled, true);
    assert.equal(f.frame().props.pointerEvents, 'none');
});

test('crop processing protects close until manipulation/upload finishes and exports the gallery dimensions', async () => {
    const pending = deferred();
    const f = setup(); f.layoutFrame();
    f.state.manipulate = () => pending.promise;
    const upload = f.find('GradientButton').props.onPress(); f.render();
    assert.equal(f.find('Modal').props.onRequestClose, undefined);
    assert.equal(f.find('GradientButton').props.loading, true);
    assert.equal(f.find('GradientButton').props.disabled, true);
    assert.equal(f.state.manipulations.length, 1);
    const [uri, operations, options] = f.state.manipulations[0];
    assert.equal(uri, 'file:///source.jpg');
    assert.deepEqual(plain(operations), [
        { crop: { originX: 0, originY: 0, width: 1200, height: 1600 } },
        { resize: { width: 1080, height: 1440 } },
    ]);
    assert.deepEqual(plain(options), { compress: 0.92, format: 'jpeg' });
    pending.resolve({ uri: 'file:///ready.jpg' }); await upload; f.render();
    assert.deepEqual(f.state.uploads, ['file:///ready.jpg']);
    assert.equal(f.find('Modal').props.onRequestClose, f.props.onClose);
    assert.equal(f.find('GradientButton').props.disabled, false);
    assert.deepEqual(f.state.errors, []);
});

test('rotation remains part of exported crop and preserves bounds', async () => {
    const f = setup(); f.layoutFrame();
    f.nodes().find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Rotate').props.onPress(); f.render();
    await f.find('GradientButton').props.onPress(); f.render();
    const operations = f.state.manipulations[0][1];
    assert.equal(operations[0].rotate, 90);
    const crop = operations.find(operation => operation.crop).crop;
    assert.ok(crop.originX >= 0 && crop.originY >= 0);
    assert.ok(crop.originX + crop.width <= 1600);
    assert.ok(crop.originY + crop.height <= 1200);
    assert.deepEqual(f.state.uploads, ['file:///cropped.jpg']);
});

test('crop errors use the existing callback and release the busy close guard', async () => {
    const f = setup(); f.layoutFrame();
    f.state.manipulate = async () => { throw Error('crop_failed'); };
    await f.find('GradientButton').props.onPress(); f.render();
    assert.deepEqual(f.state.errors, ['crop_failed']);
    assert.deepEqual(f.state.uploads, []);
    assert.equal(f.find('GradientButton').props.loading, false);
    assert.equal(f.find('Modal').props.onRequestClose, f.props.onClose);
});

test('crop action does not manipulate or upload until native frame dimensions are known', async () => {
    const f = setup();
    await f.find('GradientButton').props.onPress();
    assert.equal(f.state.manipulations.length, 0);
    assert.equal(f.state.uploads.length, 0);
});

test('small Android viewport fits a 216x288 profile frame while retaining 1080x1440 export', async () => {
    const f = setup({ os: 'android' });
    const area = () => f.nodes().find(node => node.type === 'View' && node.props.onLayout && !node.props.onPanResponderGrant);
    area().props.onLayout({ nativeEvent: { layout: { width: 390, height: 300 } } }); f.render();
    let style = flatten(f.frame().props.style);
    assert.equal(style.width, 216);
    assert.equal(style.aspectRatio, 3 / 4);
    assert.equal(style.width / style.aspectRatio, 288);
    f.layoutFrame(216, 288);
    await f.find('GradientButton').props.onPress(); f.render();
    assert.deepEqual(plain(f.state.manipulations[0][1].at(-1)), { resize: { width: 1080, height: 1440 } });
    assert.deepEqual(f.state.uploads, ['file:///cropped.jpg']);

    area().props.onLayout({ nativeEvent: { layout: { width: 780, height: 200 } } }); f.render();
    style = flatten(f.frame().props.style);
    assert.equal(style.width, 141);
    assert.equal(style.width / style.aspectRatio, 188);
    assert.ok(style.width <= 780 - 44);
    assert.ok(style.width / style.aspectRatio <= 200 - 12);
    area().props.onLayout({ nativeEvent: { layout: { width: 780, height: 200 } } }); f.render();
    assert.equal(flatten(f.frame().props.style).width, 141);
});
