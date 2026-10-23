const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const source = fs.readFileSync(path.join(__dirname, '../components/ui/SingleSelectSheet.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

function setup(os, presentation, visible = false) {
    const slots = [];
    const effects = [];
    const frames = new Map();
    const actions = [];
    let nextFrame = 1;
    let cursor = 0;
    let dirty = false;
    let tree;
    const mockReact = {
        ...React,
        useRef(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = { current: initial };
            return slots[index];
        },
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
            return [slots[index], value => {
                const next = typeof value === 'function' ? value(slots[index]) : value;
                if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
            }];
        },
        useMemo(factory, deps) {
            const index = cursor++;
            if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() };
            return slots[index].value;
        },
        useCallback(callback, deps) { return mockReact.useMemo(() => callback, deps); },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(slots[index]?.deps, deps)) effects.push(() => {
                slots[index]?.cleanup?.();
                slots[index] = { deps, cleanup: effect() };
            });
        },
    };
    const animation = { duration() { return this; }, easing() { return this; } };
    const timing = {};
    const palette = {
        brand: { text: { body: 'body', muted: 'muted', subtitle: 'subtitle' }, bg: { border: 'border' }, accent: { error: 'error' }, gradient: { start: 'start', end: 'end' } },
        chrome: { primary: 'primary', common: { card: 'card', primaryTint: 'tint', inverseText: 'inverse' } },
    };
    const context = {
        exports: {},
        requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        setTimeout: () => assert.fail('Dismissal must not use fixed timers'),
        require(name) {
            if (name === 'react') return mockReact;
            if (name === 'react/jsx-runtime') return require(name);
            if (name === 'react-native') return {
                ...Object.fromEntries(['View', 'Pressable', 'Modal', 'FlatList', 'TextInput', 'KeyboardAvoidingView'].map(value => [value, value])),
                Platform: { OS: os }, Dimensions: { get: () => ({ height: 844, width: 390 }) },
                StyleSheet: { create: value => value, absoluteFill: {} },
            };
            if (name === '@gorhom/bottom-sheet') return {
                __esModule: true, default: 'BottomSheet', BottomSheetBackdrop: 'BottomSheetBackdrop',
                BottomSheetFlatList: 'BottomSheetFlatList', BottomSheetTextInput: 'BottomSheetTextInput',
                useBottomSheetTimingConfigs: () => timing,
            };
            if (name === 'react-native-reanimated') return {
                __esModule: true, default: { View: 'AnimatedView' }, Easing: { bezier: () => ({}) }, SlideInLeft: animation, SlideInRight: animation,
            };
            if (name === '@/hooks/useTheme') return { useTheme: () => ({ isDark: false }) };
            if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL: false }) };
            if (name === '@/hooks/useColors') return { useColors: () => palette };
            if (name === '@/hooks/useHaptics') return { useHaptics: () => ({ lightImpact: () => actions.push('haptic') }) };
            if (name === '@/hooks/useResponsive') return { scale: value => value };
            if (name === '@/constants/typography') return { fontFamilyForText: () => 'existing-font' };
            if (name === '@/lib/profileDisplay') return { t: (_key, fallback) => fallback };
            if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) };
            if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: 'GestureHandlerRootView' };
            if (name === 'expo-linear-gradient') return { LinearGradient: 'LinearGradient' };
            if (name === 'phosphor-react-native') return Object.fromEntries(['CaretLeft', 'CaretRight', 'Check', 'MagnifyingGlass', 'X'].map(value => [value, value]));
            if (name.startsWith('./')) { const component = name.slice(2); return { [component]: component }; }
            throw new Error(`Unexpected import: ${name}`);
        },
    };
    vm.runInNewContext(compiled, context);
    const props = {
        visible, presentation, title: 'Photo source', optionMode: 'action',
        options: [{ value: 'camera', label: 'Camera' }],
        onSelect: value => actions.push(['select', value]), onClose: () => actions.push('close'),
        onDismiss: () => actions.push('dismiss'),
    };
    const render = changes => {
        Object.assign(props, changes);
        let passes = 0;
        do {
            assert.ok(passes++ < 20, 'Effects must settle');
            dirty = false;
            cursor = 0;
            tree = context.exports.SingleSelectSheet(props);
            while (effects.length) effects.shift()();
        } while (dirty);
        return tree;
    };
    render();
    return {
        actions, frames, render,
        find: type => descendants(tree).find(node => node.type === type),
        frame() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } },
        unmount() { for (const slot of slots) slot?.cleanup?.(); },
    };
}

for (const presentation of ['sheet', 'drawer']) {
    test(`ios/${presentation}: native event gates dismissal, once per open-close, using latest callback`, () => {
        const f = setup('ios', presentation);
        const nativeDismiss = () => f.find('Modal').props.onDismiss();
        nativeDismiss();
        assert.deepEqual(f.actions, []);
        f.render({ visible: true });
        nativeDismiss();
        f.find('Modal').props.onRequestClose();
        nativeDismiss();
        assert.deepEqual(f.actions, ['close']);
        f.render({ visible: false });
        assert.equal(f.frames.size, 0);
        assert.deepEqual(f.actions, ['close']);
        f.render({ onDismiss: () => f.actions.push('latest-dismiss') });
        nativeDismiss(); nativeDismiss();
        assert.deepEqual(f.actions, ['close', 'latest-dismiss']);
        f.render({ visible: true });
        f.render({ visible: false });
        nativeDismiss();
        assert.deepEqual(f.actions, ['close', 'latest-dismiss', 'latest-dismiss']);
        f.unmount();
    });

    test(`ios/${presentation}: reopening and unmount suppress late native dismissal events`, () => {
        const f = setup('ios', presentation, true);
        const lateDismiss = f.find('Modal').props.onDismiss;
        f.render({ visible: false });
        f.render({ visible: true });
        lateDismiss();
        assert.deepEqual(f.actions, []);
        f.render({ visible: false });
        f.unmount();
        lateDismiss();
        assert.deepEqual(f.actions, []);
    });

    test(`android/${presentation}: hidden transition schedules one frame, callback changes do not restart it`, () => {
        const f = setup('android', presentation);
        assert.equal(f.frames.size, 0);
        assert.equal(f.find('Modal').props.onDismiss, undefined);
        assert.equal(f.find('Modal').props.animationType, 'none');
        f.render({ visible: true });
        assert.equal(f.frames.size, 0);
        f.render({ visible: false });
        assert.deepEqual(f.actions, []);
        assert.equal(f.frames.size, 1);
        const [frameId] = f.frames.keys();
        f.render({ onDismiss: () => f.actions.push('latest-dismiss') });
        assert.deepEqual([...f.frames.keys()], [frameId]);
        f.frame(); f.frame();
        f.render({ visible: false });
        f.frame();
        assert.deepEqual(f.actions, ['latest-dismiss']);
        f.render({ visible: true }); f.render({ visible: false }); f.frame();
        assert.deepEqual(f.actions, ['latest-dismiss', 'latest-dismiss']);
        f.unmount();
    });

    test(`android/${presentation}: reopen cancels old frame, unmount cancels pending callback`, () => {
        const f = setup('android', presentation, true);
        f.render({ visible: false });
        const staleFrame = [...f.frames.values()][0];
        f.render({ visible: true });
        assert.equal(f.frames.size, 0);
        staleFrame();
        assert.deepEqual(f.actions, []);
        f.render({ visible: false });
        const unmountedFrame = [...f.frames.values()][0];
        f.unmount();
        assert.equal(f.frames.size, 0);
        unmountedFrame();
        assert.deepEqual(f.actions, []);
    });

    for (const os of ['ios', 'android']) {
        test(`${os}/${presentation}: selection still precedes onClose; contents unmount while hidden`, () => {
            const f = setup(os, presentation, true);
            const listType = presentation === 'sheet' ? 'BottomSheetFlatList' : 'FlatList';
            const list = f.find(listType);
            list.props.renderItem({ item: list.props.data[0] }).props.onPress();
            assert.deepEqual(f.actions, ['haptic', ['select', 'camera'], 'close']);
            f.render({ visible: false });
            assert.equal(f.find(listType), undefined);
            assert.ok(f.find('Modal'));
            if (os === 'ios') f.find('Modal').props.onDismiss();
            else f.frame();
            assert.deepEqual(f.actions, ['haptic', ['select', 'camera'], 'close', 'dismiss']);
            f.render({ visible: true });
            assert.ok(f.find(listType));
            if (presentation === 'sheet') assert.equal(f.find('BottomSheet').props.index, 0);
            f.unmount();
        });
    }
}
