const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};

function setup(file, exported, initialProps, options = {}) {
    const slots = [];
    const effects = [];
    const timers = new Map();
    const hideListeners = new Set();
    const actions = [];
    let cursor = 0;
    let dirty = false;
    let now = 0;
    let nextTimer = 1;
    let tree;
    const keyboard = { visible: false, focused: null, ...options.keyboard };
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
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
    function NativeTextInput() {}
    NativeTextInput.State = { currentlyFocusedInput: () => keyboard.focused };
    const native = {
        Platform: { OS: options.platform || 'android' },
        View: 'View', Pressable: 'Pressable', TextInput: NativeTextInput, Modal: 'Modal', FlatList: 'FlatList',
        StyleSheet: { create: value => value }, PixelRatio: { roundToNearestPixel: value => value },
        Keyboard: {
            isVisible: () => keyboard.visible,
            dismiss: () => actions.push('dismiss'),
            addListener(name, callback) {
                assert.equal(name, 'keyboardDidHide');
                hideListeners.add(callback);
                return { remove: () => hideListeners.delete(callback) };
            },
        },
    };
    const palette = {
        brand: { text: { muted: 'muted', subtitle: 'subtitle' } },
        chrome: { primary: 'brand', common: { card: 'card', primaryTint: 'tint', textStrong: 'text' } },
    };
    const context = {
        exports: {},
        setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, due: now + delay }); return id; },
        clearTimeout: id => timers.delete(id),
        require(name) {
            if (name === 'react') return mockReact;
            if (name === 'react/jsx-runtime') return require(name);
            if (name === 'react-native') return native;
            if (name === '@react-native-community/datetimepicker') return { __esModule: true, default: 'DateTimePicker' };
            if (name === '@/hooks/useResponsive') return { scale: value => value * (options.scale || 1) };
            if (name === '@/hooks/useTheme') return { useTheme: () => ({ isDark: Boolean(options.isDark) }) };
            if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL: Boolean(options.isRTL), currentLanguage: options.language || 'en' }) };
            if (name === '@/hooks/useColors') return { useColors: () => palette };
            if (name === '@/hooks/useHaptics') return { useHaptics: () => ({ lightImpact() {} }) };
            if (name === '@/constants/typography') return { fontFamilyForText: () => 'existing-font' };
            if (name === '@/lib/profileDisplay') return { t: (_key, fallback) => fallback };
            if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 34 }) };
            if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: 'GestureHandlerRootView' };
            if (name === '@gorhom/bottom-sheet') return { __esModule: true, default: 'BottomSheet', BottomSheetView: 'BottomSheetView', BottomSheetBackdrop: 'BottomSheetBackdrop' };
            if (name === 'react-native-reanimated') return { __esModule: true, default: { Text: 'AnimatedText', FlatList: 'AnimatedFlatList' } };
            if (name === 'phosphor-react-native') return { X: 'X' };
            if (name === 'expo-linear-gradient') return { LinearGradient: 'LinearGradient' };
            if (name.startsWith('./')) { const component = name.slice(2); return { [component]: component }; }
            throw new Error(`Unexpected import: ${name}`);
        },
    };
    vm.runInNewContext(ts.transpileModule(read(file), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText, context, { filename: file });
    const props = { ...initialProps };
    const render = changes => {
        Object.assign(props, changes);
        let passes = 0;
        do {
            assert.ok(passes++ < 20, 'Effects must settle');
            dirty = false;
            cursor = 0;
            tree = context.exports[exported](props);
            while (effects.length) effects.shift()();
        } while (dirty);
        return tree;
    };
    render();
    return {
        render, actions, keyboard, timers, hideListeners, native,
        nodes: () => descendants(tree),
        find: type => descendants(tree).find(node => node.type === type),
        unmount() { for (const slot of slots) slot?.cleanup?.(); },
        hide() {
            keyboard.visible = false; keyboard.focused = null;
            for (const callback of [...hideListeners]) callback();
        },
        advance(ms) {
            now += ms;
            for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback(); }
        },
    };
}

function select(options = {}) {
    const opens = [];
    const f = setup('components/ui/FormField.tsx', 'SelectField', {
        value: '', placeholder: 'Nationality', required: true,
        icon: React.createElement('Icon'), onPress: () => opens.push('open'),
    }, options);
    return { ...f, opens, press: () => f.find('Pressable').props.onPress() };
}

test('SelectField spans the row, retains a 44dp minimum and makes all content pointer-transparent', () => {
    const f = select({ scale: 0.75 });
    const field = f.find('Pressable');
    const style = flatten(field.props.style);
    assert.equal(style.width, '100%');
    assert.ok(style.minHeight >= 44);
    assert.equal(field.props.accessibilityRole, 'button');
    assert.equal(field.props.children.type, 'View');
    assert.equal(field.props.children.props.pointerEvents, 'none');
    assert.ok(descendants(field.props.children).some(node => node.type === 'Icon'));
    assert.equal(f.find('Text').props.children, 'Nationality *');
    f.render({ value: 'Germany' });
    assert.equal(f.find('Text').props.children, 'Germany');
});

test('SelectField opens immediately when neither keyboard nor input is focused', () => {
    const f = select();
    f.press();
    assert.deepEqual(f.opens, ['open']);
    assert.equal(f.timers.size, 0);
    assert.equal(f.hideListeners.size, 0);
    assert.deepEqual(f.actions, []);
});

for (const keyboard of [{ visible: true, focused: null }, { visible: false, focused: {} }]) {
    test(`SelectField waits once for keyboard hide (visible=${keyboard.visible}) and suppresses pending double taps`, () => {
        const f = select({ keyboard });
        f.press(); f.press(); f.press();
        assert.equal(f.opens.length, 0);
        assert.deepEqual(f.actions, ['dismiss']);
        assert.equal(f.hideListeners.size, 1);
        assert.equal(f.timers.size, 1);
        const staleHide = [...f.hideListeners][0];
        f.hide();
        f.advance(1000); staleHide();
        assert.deepEqual(f.opens, ['open']);
        assert.equal(f.hideListeners.size, 0);
        assert.equal(f.timers.size, 0);
    });
}

test('SelectField fallback opens once at 500ms and uses the latest callback', () => {
    const f = select({ keyboard: { visible: true } });
    f.press();
    const staleHide = [...f.hideListeners][0];
    f.render({ onPress: () => f.opens.push('latest') });
    f.advance(499);
    assert.equal(f.opens.length, 0);
    f.advance(1); staleHide(); f.advance(1000);
    assert.deepEqual(f.opens, ['latest']);
    assert.equal(f.hideListeners.size, 0);
    assert.equal(f.timers.size, 0);
});

test('SelectField unmount removes the listener and fallback without opening', () => {
    const f = select({ keyboard: { visible: true } });
    f.press();
    const staleHide = [...f.hideListeners][0];
    f.unmount();
    f.advance(1000); staleHide();
    assert.equal(f.opens.length, 0);
    assert.equal(f.hideListeners.size, 0);
    assert.equal(f.timers.size, 0);
});

for (const refType of ['callback', 'object']) {
    test(`Input row focuses its native input and preserves ${refType} inputRef`, () => {
        const refs = [];
        const objectRef = { current: null };
        const inputRef = refType === 'object' ? objectRef : node => { refs.push(node); };
        const events = [];
        const f = setup('components/ui/Input.tsx', 'Input', {
            placeholder: 'Name', inputRef,
            onFocus: event => events.push(event), onBlur: event => events.push(event),
        }, { scale: 0.75 });
        const input = f.find(f.native.TextInput);
        const node = { focus: () => f.actions.push('focus') };
        input.props.ref(node);
        assert.equal(refType === 'object' ? objectRef.current : refs[0], node);
        const row = f.find('Pressable');
        assert.equal(row.props.accessible, false);
        assert.ok(flatten(row.props.style).minHeight >= 44);
        row.props.onPress();
        assert.deepEqual(f.actions, ['focus']);
        const focus = { nativeEvent: { target: 1 } };
        const blur = { nativeEvent: { target: 1 } };
        input.props.onFocus(focus); f.render();
        assert.equal(flatten(f.find('Pressable').props.style).borderBottomWidth, 1.5);
        f.find(f.native.TextInput).props.onBlur(blur); f.render();
        assert.deepEqual(events, [focus, blur]);
        assert.equal(flatten(f.find('Pressable').props.style).borderBottomWidth, 1);
        input.props.ref(null);
        assert.equal(refType === 'object' ? objectRef.current : refs.at(-1), null);
        f.find('Pressable').props.onPress();
        assert.equal(f.actions.length, 1);
    });
}

test('Input does not row-focus an editable=false field and forwards readOnly unchanged', () => {
    const f = setup('components/ui/Input.tsx', 'Input', { editable: false, readOnly: true });
    f.find(f.native.TextInput).props.ref({ focus: () => f.actions.push('focus') });
    f.find('Pressable').props.onPress();
    assert.deepEqual(f.actions, []);
    assert.equal(f.find(f.native.TextInput).props.editable, false);
    assert.equal(f.find(f.native.TextInput).props.readOnly, true);
});

test('Input preserves React 19 callback-ref cleanup on detach', () => {
    const f = setup('components/ui/Input.tsx', 'Input', {
        inputRef: node => {
            assert.ok(node, 'A callback returning cleanup must not receive a synthetic null detach');
            return () => f.actions.push('cleanup');
        },
    });
    const cleanup = f.find(f.native.TextInput).props.ref({ focus() {} });
    assert.equal(typeof cleanup, 'function', 'The composed ref must preserve React 19 cleanup');
    cleanup();
    assert.deepEqual(f.actions, ['cleanup']);
});

test('DateWheelSheet removes the hidden native sheet subtree and reopens at index zero with fresh date state', () => {
    const confirmed = [];
    let closes = 0;
    const f = setup('components/ui/DateWheelSheet.tsx', 'DateWheelSheet', {
        visible: false, value: new Date(2000, 1, 20),
        minDate: new Date(1940, 0, 1), maxDate: new Date(2008, 9, 17), title: 'Birthday',
        onClose: () => { closes++; }, onConfirm: date => confirmed.push(date),
    });
    assert.equal(f.find('Modal').props.visible, false);
    assert.equal(f.find('BottomSheet'), undefined);
    assert.equal(f.find('GestureHandlerRootView'), undefined);
    f.render({ visible: true });
    assert.equal(f.find('BottomSheet').props.index, 0);
    const wheels = () => f.nodes().filter(node => typeof node.type === 'function' && node.type.name === 'Wheel');
    assert.deepEqual(wheels().map(node => node.props.selected), [20, 1, 2000]);
    wheels()[0].props.onChange(5); f.render();
    assert.equal(wheels()[0].props.selected, 5);
    f.find('BottomSheet').props.onClose();
    assert.equal(closes, 1);
    assert.equal(confirmed.length, 0);
    f.render({ visible: false });
    assert.equal(f.find('BottomSheet'), undefined);
    f.render({ visible: true, value: new Date(1998, 4, 12) });
    assert.equal(f.find('BottomSheet').props.index, 0);
    assert.deepEqual(wheels().map(node => node.props.selected), [12, 4, 1998]);
    f.find('GradientButton').props.onPress();
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0].getFullYear(), 1998);
    assert.equal(confirmed[0].getMonth(), 4);
    assert.equal(confirmed[0].getDate(), 12);
    assert.equal(closes, 2);
});

for (const isDark of [false, true]) {
    test(`iOS DOB uses native wheels with locale, range and explicit confirmation (dark=${isDark})`, () => {
        const confirmed = [];
        let closes = 0;
        const minDate = new Date(1940, 0, 1);
        const maxDate = new Date(2008, 9, 17);
        const initial = new Date(2000, 1, 20);
        const f = setup('components/ui/DateWheelSheet.tsx', 'DateWheelSheet', {
            visible: false, value: initial, minDate, maxDate, title: 'Birthday',
            onClose: () => { closes++; }, onConfirm: date => confirmed.push(date),
        }, { platform: 'ios', language: 'ar', isRTL: true, isDark });
        assert.equal(f.find('DateTimePicker'), undefined);
        f.render({ visible: true });
        const picker = () => f.find('DateTimePicker').props;
        assert.equal(picker().mode, 'date');
        assert.equal(picker().display, 'spinner');
        assert.equal(picker().locale, 'ar');
        assert.equal(picker().themeVariant, isDark ? 'dark' : 'light');
        assert.equal(picker().textColor, 'text');
        const pickerRow = f.nodes().find(node => node.type === 'View' && node.props.children?.type === 'DateTimePicker');
        assert.equal(flatten(pickerRow.props.style).width, '100%');
        assert.equal(flatten(pickerRow.props.style).alignItems, 'center');
        assert.equal(picker().style.width, undefined, 'Preserve native intrinsic sizing without stretching text');
        assert.equal(picker().minimumDate, minDate);
        assert.equal(picker().maximumDate, maxDate);
        assert.equal(f.nodes().filter(node => typeof node.type === 'function' && node.type.name === 'Wheel').length, 0);
        assert.equal(picker().value.getTime(), initial.getTime());
        picker().onValueChange({}, new Date(1998, 4, 12)); f.render();
        assert.equal(confirmed.length, 0);
        f.find('Pressable').props.onPress();
        assert.equal(closes, 1);
        assert.equal(confirmed.length, 0);
        f.render({ visible: false });
        f.render({ visible: true });
        assert.equal(picker().value.getTime(), initial.getTime(), 'Cancel discards the draft');
        picker().onValueChange({}, new Date(1996, 1, 29)); f.render();
        assert.equal(f.find('GradientButton').props.title, 'Done');
        f.find('GradientButton').props.onPress();
        assert.equal(confirmed.length, 1);
        assert.equal(confirmed[0].getFullYear(), 1996);
        assert.equal(confirmed[0].getMonth(), 1);
        assert.equal(confirmed[0].getDate(), 29);
        assert.equal(closes, 2);
    });
}

test('iOS DOB clamps native values and ignores invalid picker events', () => {
    const minDate = new Date(1940, 0, 1);
    const maxDate = new Date(2008, 9, 17);
    const f = setup('components/ui/DateWheelSheet.tsx', 'DateWheelSheet', {
        visible: true, value: new Date(2030, 0, 1), minDate, maxDate, title: 'Birthday',
        onClose() {}, onConfirm() {},
    }, { platform: 'ios' });
    const picker = () => f.find('DateTimePicker').props;
    assert.equal(picker().value.getTime(), maxDate.getTime());
    picker().onValueChange({}, new Date(1900, 0, 1)); f.render();
    assert.equal(picker().value.getTime(), minDate.getTime());
    picker().onValueChange({}, new Date(NaN)); f.render();
    assert.equal(picker().value.getTime(), minDate.getTime());
    f.render({ minDate: new Date(minDate), maxDate: new Date(maxDate) });
    assert.equal(picker().value.getTime(), minDate.getTime(), 'Equivalent range objects do not reset the draft');
});

test('step1 uses root nationality/grew_up_in placeholder translations present in all 11 locales', () => {
    const source = ts.createSourceFile('step1.tsx', read('app/(profile-setup)/step1.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const keys = [];
    function visit(node) {
        if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === 'SelectField') {
            const placeholder = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'placeholder');
            const expression = placeholder?.initializer?.expression;
            if (expression && ts.isCallExpression(expression) && expression.expression.getText(source) === 't') keys.push(expression.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(keys.includes('common:nationality'));
    assert.ok(keys.includes('common:grew_up_in'));
    assert.ok(!keys.includes('common:step_1.select_nationality'));
    assert.ok(!keys.includes('common:step_1.select_country'));
    for (const locale of ['en', 'ar', 'de', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr']) {
        const common = JSON.parse(read(`locales/${locale}/common.json`));
        for (const key of ['nationality', 'grew_up_in']) {
            assert.equal(typeof common[key], 'string', `${locale}.${key}`);
            assert.ok(common[key].trim(), `${locale}.${key} must not be empty`);
        }
    }
});
