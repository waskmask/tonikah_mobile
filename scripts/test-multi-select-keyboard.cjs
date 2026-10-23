const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const source = fs.readFileSync(path.join(__dirname, '../components/ui/MultiSelectSheet.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

function descendants(node) {
    if (Array.isArray(node)) return node.flatMap(descendants);
    if (!node || typeof node !== 'object') return [];
    return [node, ...descendants(node.props?.children)];
}

function flatten(style) {
    if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
    return style && typeof style === 'object' ? style : {};
}

function setup({ presentation = 'drawer', os = 'ios', isRTL = false, isDark = false, ...overrides } = {}) {
    const hooks = [];
    const effects = [];
    const actions = [];
    const keyboardListeners = new Map();
    let cursor = 0;
    let dirty = false;
    let tree;
    const mockReact = {
        ...React,
        useState: (initial) => {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
            return [hooks[index], (value) => {
                const next = typeof value === 'function' ? value(hooks[index]) : value;
                if (!Object.is(next, hooks[index])) { hooks[index] = next; dirty = true; }
            }];
        },
        useRef: (initial) => {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = { current: initial };
            return hooks[index];
        },
        useMemo: (fn) => fn(),
        useCallback: (fn) => fn,
        useEffect: (effect, deps) => {
            const index = cursor++;
            if (!hooks[index] || deps.some((value, i) => value !== hooks[index].deps[i])) effects.push(() => {
                hooks[index]?.cleanup?.();
                hooks[index] = { deps, cleanup: effect() };
            });
        },
    };
    const palette = {
        brand: { text: { body: 'body', subtitle: 'subtitle', muted: 'muted' }, bg: { border: 'border' } },
        chrome: { primary: 'primary', common: { card: isDark ? 'dark-card' : 'light-card', primaryTint: 'tint', inverseText: 'inverse' } },
    };
    const animation = { duration() { return this; }, easing() { return this; } };
    const native = Object.fromEntries(['View', 'Pressable', 'Modal', 'FlatList', 'TextInput', 'KeyboardAvoidingView', 'ActivityIndicator'].map((name) => [name, name]));
    Object.assign(native, {
        Platform: { OS: os }, Keyboard: {
            dismiss: () => actions.push('dismiss'),
            addListener(name, callback) {
                const listeners = keyboardListeners.get(name) || new Set();
                keyboardListeners.set(name, listeners);
                listeners.add(callback);
                return { remove: () => listeners.delete(callback) };
            },
        },
        Dimensions: { get: () => ({ width: 390, height: 844 }) },
        StyleSheet: { create: (value) => value, absoluteFill: {} },
    });
    const context = {
        exports: {}, requestAnimationFrame: (fn) => { fn(); return 1; }, cancelAnimationFrame: () => {},
        require: (name) => {
            if (name === 'react') return mockReact;
            if (name === 'react/jsx-runtime') return require(name);
            if (name === 'react-native') return native;
            if (name === '@gorhom/bottom-sheet') return {
                __esModule: true, default: 'BottomSheet', BottomSheetBackdrop: 'BottomSheetBackdrop',
                BottomSheetFlatList: 'BottomSheetFlatList', BottomSheetTextInput: 'BottomSheetTextInput',
                useBottomSheetTimingConfigs: () => ({}),
            };
            if (name === 'react-native-reanimated') return {
                __esModule: true, default: { View: 'AnimatedView' }, Easing: { bezier: () => ({}) },
                FadeIn: animation, SlideInDown: animation, SlideInLeft: animation, SlideInRight: animation,
            };
            if (name === '@/hooks/useTheme') return { useTheme: () => ({ isDark }) };
            if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL }) };
            if (name === '@/hooks/useColors') return { useColors: () => palette };
            if (name === '@/hooks/useResponsive') return { scale: (value) => value };
            if (name === 'react-native-safe-area-context') return {
                useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 12, right: 12 }),
                SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'NativeSafeAreaView',
            };
            if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: 'GestureHandlerRootView' };
            if (name === '@/constants/typography') return { fontFamilyForText: () => 'existing-font' };
            if (name === '@/lib/profileDisplay') return { t: (_key, fallback) => fallback };
            if (name === 'phosphor-react-native') return Object.fromEntries(['CaretLeft', 'CaretRight', 'Check', 'MagnifyingGlass', 'X'].map((icon) => [icon, icon]));
            if (name.startsWith('./')) { const component = name.slice(2); return { [component]: component }; }
            throw new Error(`Unexpected import: ${name}`);
        },
    };
    vm.runInNewContext(compiled, context);
    const props = {
        presentation, visible: true, title: 'Nationality', selected: [], maxSelections: 2,
        options: [{ value: 'de', label: 'Germany' }, { value: 'fr', label: 'France' }, { value: 'it', label: 'Italy' }],
        onConfirm: (values) => actions.push(['confirm', [...values]]), onClose: () => actions.push('close'),
        ...overrides,
    };
    const find = (type) => descendants(tree).find((node) => node.type === type);
    const render = () => {
        let passes = 0;
        do {
            assert.ok(passes++ < 25, 'Selection and keyboard effects must settle');
            dirty = false;
            cursor = 0;
            tree = context.exports.MultiSelectSheet(props);
            while (effects.length) effects.shift()();
        } while (dirty);
        const input = find(presentation === 'drawer' ? 'TextInput' : 'BottomSheetTextInput');
        if (input) input.props.ref.current = { blur: () => actions.push('blur') };
        return tree;
    };
    render();
    render();
    return {
        actions, render, find, props,
        nodes: () => descendants(tree),
        keyboardEvent: name => { for (const listener of keyboardListeners.get(name) || []) listener(); },
        unmount: () => { for (const hook of hooks) hook?.cleanup?.(); },
        keyboardListeners,
        list: () => find(presentation === 'drawer' ? 'FlatList' : 'BottomSheetFlatList'),
        input: () => find(presentation === 'drawer' ? 'TextInput' : 'BottomSheetTextInput'),
        row: (value) => {
            const list = find(presentation === 'drawer' ? 'FlatList' : 'BottomSheetFlatList');
            return list.props.renderItem({ item: list.props.data.find((option) => option.value === value) });
        },
    };
}

test('iOS drawer hides Done during search, keeps count compact, and restores Done after keyboard dismissal', () => {
    const f = setup({ selected: ['de'] });
    assert.ok(f.find('GradientButton'));
    f.keyboardEvent('keyboardWillShow'); f.render();
    assert.equal(f.find('GradientButton'), undefined);
    const footer = descendants(f.find('AnimatedView')).find(node => node.type === 'View'
        && descendants(node).some(child => child.type === 'Text' && String(child.props.children).includes('selected')));
    assert.equal(flatten(footer.props.style).paddingBottom, 0);
    const count = descendants(footer).find(node => node.type === 'Text');
    assert.equal(count.props.children, '1/2 selected');
    assert.equal(flatten(count.props.style).marginBottom, 0);
    assert.equal(flatten(f.find('AnimatedView').props.style).paddingBottom, 0);
    f.row('fr').props.onPress(); f.render();
    assert.equal(f.find('GradientButton'), undefined, 'Wait for actual keyboard hide');
    f.keyboardEvent('keyboardDidHide'); f.render();
    assert.ok(f.find('GradientButton'));
    assert.equal(flatten(f.find('AnimatedView').props.style).paddingBottom, 34);
    f.find('GradientButton').props.onPress();
    assert.deepEqual(f.actions.at(-2), ['confirm', ['de', 'fr']]);
});

test('iOS drawer keyboard listeners restore the footer and are removed on close/unmount', () => {
    const f = setup();
    f.keyboardEvent('keyboardWillShow'); f.render();
    assert.equal(f.find('GradientButton'), undefined);
    f.props.visible = false; f.render(); f.render();
    assert.ok(f.find('GradientButton'));
    assert.ok([...f.keyboardListeners.values()].every(listeners => listeners.size === 0));
    f.props.visible = true; f.render();
    f.unmount();
    assert.ok([...f.keyboardListeners.values()].every(listeners => listeners.size === 0));
});

test('Android drawer keeps its existing Done button during search', () => {
    const f = setup({ os: 'android' });
    f.keyboardEvent('keyboardWillShow'); f.render();
    assert.ok(f.find('GradientButton'));
    assert.equal(f.keyboardListeners.size, 0);
});

for (const presentation of ['drawer', 'sheet']) {
    for (const os of ['ios', 'android']) {
        test(`${presentation}/${os}: first option tap selects, blurs search, dismisses keyboard and preserves search`, () => {
            const f = setup({ presentation, os });
            f.input().props.onChangeText('germ');
            f.render();
            assert.equal(f.list().props.keyboardShouldPersistTaps, 'always');
            assert.equal(f.list().props.keyboardDismissMode, os === 'ios' ? 'interactive' : 'on-drag');
            assert.equal(f.list().props.data.length, 1);
            const row = f.row('de');
            assert.equal(row.type, 'Pressable');
            row.props.onPress();
            assert.deepEqual(f.actions, ['blur', 'dismiss']);
            f.render();
            assert.equal(f.input().props.value, 'germ');
            assert.equal(f.find('GradientButton').props.disabled, false);
            f.find('GradientButton').props.onPress();
            assert.deepEqual(f.actions.slice(2), ['blur', 'dismiss', ['confirm', ['de']], 'close']);
            f.render();
            assert.equal(f.input().props.value, '');
        });

        test(`${presentation}/${os}: Return Done dismisses without confirming or closing`, () => {
            const f = setup({ presentation, os });
            assert.equal(f.input().props.returnKeyType, 'done');
            assert.equal(f.input().props.submitBehavior, 'blurAndSubmit');
            f.input().props.onSubmitEditing();
            assert.deepEqual(f.actions, ['blur', 'dismiss']);
        });
    }

    test(`${presentation}: max selection, deselection and cancel semantics remain intact`, () => {
        const f = setup({ presentation, selected: ['de'], maxSelections: 1 });
        assert.equal(f.row('fr').props.disabled, true);
        f.row('de').props.onPress();
        f.render();
        assert.equal(f.find('GradientButton').props.disabled, true);
        assert.equal(f.row('fr').props.disabled, false);
        f.row('fr').props.onPress();
        f.render();
        f.find('Modal').props.onRequestClose();
        assert.deepEqual(f.actions.slice(-3), ['blur', 'dismiss', 'close']);
        assert.equal(f.actions.some((action) => Array.isArray(action) && action[0] === 'confirm'), false);
        f.render();
        f.find('GradientButton').props.onPress();
        assert.deepEqual(f.actions.at(-2), ['confirm', ['de']]);
    });

    test(`${presentation}: RTL/dark styling and empty-selection save rules remain intact`, () => {
        const f = setup({ presentation, isRTL: true, isDark: true, allowEmptySelection: true });
        assert.equal(flatten(f.find('GestureHandlerRootView').props.style).direction, 'rtl');
        assert.equal(flatten(f.input().props.style).textAlign, 'right');
        assert.equal(f.find('GradientButton').props.disabled, false);
        if (presentation === 'sheet') {
            assert.equal(f.find('BottomSheet').props.backgroundStyle.backgroundColor, 'dark-card');
        } else {
            assert.equal(flatten(f.find('AnimatedView').props.style).backgroundColor, 'dark-card');
        }
        f.props.error = true;
        f.render();
        assert.equal(f.find('GradientButton').props.disabled, true);
        f.props.error = false;
        f.props.loading = true;
        f.render();
        assert.equal(f.find('GradientButton').props.disabled, true);
    });
}

test('iOS drawer can shrink inside KAV while its footer remains outside the scrolling list', () => {
    const f = setup();
    assert.equal(f.find('KeyboardAvoidingView').props.behavior, 'padding');
    const drawer = f.find('AnimatedView');
    assert.equal(flatten(drawer.props.style).flex, 1);
    assert.equal(flatten(drawer.props.style).minHeight, 0);
    assert.equal(flatten(f.list().props.style).flex, 1);
    assert.equal(descendants(f.list()).some((node) => node.type === 'GradientButton'), false);
    assert.equal(descendants(drawer).some((node) => node.type === 'GradientButton'), true);
});

test('sheet offsets above keyboard and permits gesture blur and pan-down cancellation', () => {
    const f = setup({ presentation: 'sheet' });
    const sheet = f.find('BottomSheet');
    assert.equal(sheet.props.keyboardBehavior, 'interactive');
    assert.equal(sheet.props.keyboardBlurBehavior, 'restore');
    assert.equal(sheet.props.enableBlurKeyboardOnGesture, true);
    assert.equal(sheet.props.enablePanDownToClose, true);
    assert.equal(sheet.props.android_keyboardInputMode, 'adjustResize');
    sheet.props.onClose();
    assert.deepEqual(f.actions, ['blur', 'dismiss', 'close']);
});

for (const isRTL of [false, true]) {
    for (const isDark of [false, true]) {
        test(`Android drawer RTL=${isRTL}, dark=${isDark}: opaque native fade and steady panel use a modal-local safe area`, () => {
            const f = setup({ os: 'android', isRTL, isDark });
            const card = isDark ? 'dark-card' : 'light-card';
            const modal = f.find('Modal');
            assert.equal(modal.props.transparent, false);
            assert.equal(modal.props.backdropColor, card);
            assert.equal(modal.props.animationType, 'fade');
            const root = f.find('GestureHandlerRootView');
            assert.equal(flatten(root.props.style).backgroundColor, card);
            assert.equal(flatten(root.props.style).direction, isRTL ? 'rtl' : 'ltr');
            assert.ok(descendants(root).some(node => node.type === 'SafeAreaProvider'));
            const provider = f.find('SafeAreaProvider');
            const safeArea = f.find('NativeSafeAreaView');
            assert.ok(descendants(provider).includes(safeArea));
            assert.deepEqual([...(safeArea.props.edges || ['top', 'bottom', 'left', 'right'])].sort(), ['bottom', 'left', 'right', 'top']);
            assert.equal(provider.props.initialMetrics, undefined);
            assert.equal(flatten(safeArea.props.style).flex, 1);
            const kav = f.find('KeyboardAvoidingView');
            assert.equal(kav.props.behavior, undefined);
            const panel = descendants(kav).find(node => node.type === 'View' && flatten(node.props.style).minHeight === 0);
            assert.ok(panel, 'Android drawer uses a steady native View panel');
            assert.equal(panel.props.entering, undefined);
            assert.equal(flatten(panel.props.style).backgroundColor, card);
            assert.equal(flatten(panel.props.style).paddingTop, 6);
            assert.equal(flatten(panel.props.style).paddingBottom, 0);
            assert.equal(f.find('AnimatedView'), undefined);
            assert.ok(descendants(panel).some(node => node.type === 'GradientButton'));
            assert.equal(descendants(f.list()).some(node => node.type === 'GradientButton'), false);
            f.keyboardEvent('keyboardWillShow'); f.render();
            assert.ok(f.find('GradientButton'), 'Android keeps Done available during search');
        });
    }
}

test('iOS drawer retains its transparent window, animated panel and existing inset padding', () => {
    const f = setup({ os: 'ios' });
    assert.equal(f.find('Modal').props.transparent, true);
    assert.equal(f.find('Modal').props.animationType, 'none');
    assert.equal(f.find('SafeAreaProvider'), undefined);
    assert.equal(f.find('NativeSafeAreaView'), undefined);
    const panel = f.find('AnimatedView');
    assert.ok(panel.props.entering);
    assert.equal(flatten(panel.props.style).paddingTop, 53);
    assert.equal(flatten(panel.props.style).paddingBottom, 34);
    assert.equal(f.find('KeyboardAvoidingView').props.behavior, 'padding');
});

for (const os of ['ios', 'android']) {
    test(`${os} bottom sheet does not adopt the Android-only opaque drawer presentation`, () => {
        const f = setup({ os, presentation: 'sheet' });
        assert.equal(f.find('Modal').props.transparent, true);
        assert.equal(f.find('Modal').props.animationType, 'none');
        assert.equal(f.find('SafeAreaProvider'), undefined);
        assert.equal(f.find('NativeSafeAreaView'), undefined);
        assert.ok(f.find('BottomSheet'));
    });
}

const checked = (f, value) => descendants(f.row(value)).some(node => node.type === 'Check');
const order = f => [...f.list().props.data].map(option => option.value);

for (const presentation of ['drawer', 'sheet']) {
    for (const os of ['ios', 'android']) {
        test(`${presentation}/${os}: parent selection rerenders preserve user checks, opening pin order, and selection limits`, () => {
            const f = setup({ presentation, os, selected: ['fr'], maxSelections: 1 });
            const initialOrder = order(f);
            assert.equal(checked(f, 'fr'), true);
            f.row('fr').props.onPress(); f.render();
            f.row('it').props.onPress(); f.render();
            f.props.selected = ['de'];
            f.props.options = f.props.options.map(option => ({ ...option, label: `${option.label} updated` }));
            f.render();
            assert.equal(checked(f, 'it'), true);
            assert.equal(checked(f, 'de'), false);
            assert.equal(checked(f, 'fr'), false);
            assert.equal(f.row('de').props.disabled, true);
            assert.deepEqual(order(f), initialOrder);
            if (presentation === 'drawer') assert.deepEqual(order(f), ['fr', 'de', 'it']);
            f.props.selected = ['de']; f.render();
            assert.equal(checked(f, 'it'), true, 'A fresh equal array must not reset this editing session');
            f.find('GradientButton').props.onPress();
            assert.deepEqual(f.actions.at(-2), ['confirm', ['it']]);
        });

        test(`${presentation}/${os}: background refresh preserves search and cancel/reopen uses latest saved selection`, () => {
            const f = setup({ presentation, os, selected: ['fr'] });
            f.row('it').props.onPress(); f.render();
            f.input().props.onChangeText('ital'); f.render();
            f.props.selected = ['de']; f.render();
            assert.equal(f.input().props.value, 'ital');
            assert.deepEqual(order(f), ['it']);
            assert.equal(checked(f, 'it'), true);
            f.find('Modal').props.onRequestClose(); f.render();
            assert.equal(f.actions.some(action => Array.isArray(action) && action[0] === 'confirm'), false);
            assert.equal(f.input().props.value, '');
            f.props.visible = false; f.render();
            f.props.selected = ['it']; f.render();
            f.props.visible = true; f.render();
            assert.equal(checked(f, 'it'), true);
            assert.equal(checked(f, 'de'), false);
            assert.equal(checked(f, 'fr'), false);
            if (presentation === 'drawer') assert.deepEqual(order(f), ['it', 'de', 'fr']);
            f.find('GradientButton').props.onPress();
            assert.deepEqual(f.actions.at(-2), ['confirm', ['it']]);
        });

        test(`${presentation}/${os}: reopening without a hidden selected update still seeds the latest parent selection`, () => {
            const f = setup({ presentation, os, selected: ['fr'] });
            f.row('de').props.onPress(); f.render();
            f.props.selected = ['it']; f.render();
            assert.equal(checked(f, 'de'), true);
            assert.equal(checked(f, 'fr'), true);
            assert.equal(checked(f, 'it'), false);
            f.props.visible = false; f.render();
            f.props.visible = true; f.render();
            assert.equal(checked(f, 'it'), true);
            assert.equal(checked(f, 'de'), false);
            assert.equal(checked(f, 'fr'), false);
            f.find('GradientButton').props.onPress();
            assert.deepEqual(f.actions.at(-2), ['confirm', ['it']]);
        });
    }
}
