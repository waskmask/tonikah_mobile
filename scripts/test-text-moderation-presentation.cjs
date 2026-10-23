const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, resolve, globals = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const context = { exports: {}, require: resolve, ...globals };
    vm.runInNewContext(compiled, context, { filename: file });
    return context.exports;
}
const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
const warning = field => ({ field, fields: [field], issues: ['contact_email'], reasonCode: 'contact',
    contentHash: `hash-${field}`, fieldErrors: {}, userMessage: 'Review this text' });

function harness(file, exported, initialProps, { os = 'ios', hook = false } = {}) {
    const slots = [];
    const effects = [];
    const frames = new Map();
    const timers = new Map();
    const calls = { keyboardDismiss: 0, canceledFrames: [] };
    let nextId = 1;
    let cursor = 0;
    let dirty = false;
    let props = initialProps;
    let result;
    const hooks = {
        ...React,
        useRef(initial) {
            const index = cursor++;
            if (!slots[index]) slots[index] = { value: { current: initial } };
            return slots[index].value;
        },
        useState(initial) {
            const index = cursor++;
            if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [slots[index].value, update => {
                const next = typeof update === 'function' ? update(slots[index].value) : update;
                if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
            }];
        },
        useCallback(callback, deps) {
            const index = cursor++;
            if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
            return slots[index].value;
        },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(slots[index]?.deps, deps)) {
                const old = slots[index];
                slots[index] = { deps, cleanup: old?.cleanup };
                effects.push(() => { old?.cleanup?.(); slots[index].cleanup = effect(); });
            }
        },
    };
    const colors = {
        chrome: { primary: 'primary', common: { card: 'card', dangerRing: 'danger-ring', dangerTint: 'danger-tint' } },
        brand: { bg: { surface: 'surface', border: 'border' }, text: { muted: 'muted', body: 'body', subtitle: 'subtitle' }, accent: { error: 'error' } },
    };
    const slide = { duration: () => slide, easing: () => slide };
    const resolve = name => {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react-native') return {
            ...Object.fromEntries(['Modal', 'Pressable', 'View', 'ActivityIndicator', 'TextInput', 'ScrollView'].map(type => [type, type])),
            Platform: { OS: os }, StyleSheet: { create: styles => styles, hairlineWidth: 1 },
            useWindowDimensions: () => ({ width: 390, height: 844 }),
        };
        if (name === '@/hooks/useColors') return { useColors: () => colors };
        if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL: false, currentLanguage: 'en' }) };
        if (name === '@/hooks/useResponsive') return { scale: value => value };
        if (name === '@/lib/profileDisplay' || name === './profileDisplay') return { t: key => key };
        if (name === '@/lib/textModeration') return load('lib/textModeration.ts', resolve);
        if (name === 'phosphor-react-native' || name === '@/components/ui/icons/PhosphorCompat') return new Proxy({}, { get: (_, key) => key });
        if (name === '@gorhom/bottom-sheet') return {
            __esModule: true, default: 'BottomSheet', BottomSheetBackdrop: 'BottomSheetBackdrop',
            BottomSheetTextInput: 'BottomSheetTextInput', BottomSheetView: 'BottomSheetView',
            useBottomSheetTimingConfigs: () => ({}),
        };
        if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: 'GestureHandlerRootView' };
        if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) };
        if (name === 'react-native-reanimated') return {
            __esModule: true, default: { View: 'AnimatedView' }, Easing: { bezier: () => ({}) },
            SlideInLeft: slide, SlideInRight: slide, Extrapolation: { CLAMP: 'clamp' },
            interpolate: () => 0, useAnimatedStyle: callback => callback(),
        };
        if (name === 'react-native-keyboard-controller') return {
            KeyboardController: { dismiss: () => { calls.keyboardDismiss++; }, isVisible: () => false },
            KeyboardAvoidingView: 'KeyboardAvoidingView', KeyboardStickyView: 'KeyboardStickyView',
            useReanimatedKeyboardAnimation: () => ({ progress: { value: 0 } }),
        };
        if (name === '@/constants/typography') return { fontFamilyForText: () => 'body' };
        if (name === '@/lib/textDirection') return { getTextDirection: () => 'ltr', localeTextDirection: () => 'ltr' };
        if (name === '@/lib/profileValidation') return {
            countNonSpace: value => value.replace(/\s/g, '').length,
            trimToNonSpaceLimit: value => value,
        };
        const leaves = {
            './Text': 'Text', '@/components/ui/Text': 'Text', './GradientButton': 'GradientButton',
            '@/components/ui/GradientButton': 'GradientButton', './UnderlineTextInput': 'UnderlineTextInput',
            './ConfirmSheet': 'ConfirmSheet', '@/components/app/UnderReviewPill': 'UnderReviewPill',
        };
        if (leaves[name]) return { [leaves[name]]: leaves[name] };
        throw new Error(`Unexpected presentation import: ${name}`);
    };
    const api = load(file, resolve, {
        requestAnimationFrame: callback => { const id = nextId++; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => { calls.canceledFrames.push(id); frames.delete(id); },
        setTimeout: callback => { const id = nextId++; timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id),
    });
    const render = next => {
        if (next !== undefined) props = hook ? next : { ...props, ...next };
        let passes = 0;
        do {
            assert.ok(++passes < 30, 'presentation effects should converge');
            dirty = false; cursor = 0; result = api[exported](props);
            effects.splice(0).forEach(effect => effect());
        } while (dirty);
        return result;
    };
    render();
    return {
        calls, frames, timers, render,
        get value() { return result; },
        find: type => descendants(result).find(node => node.type === type),
        act(callback) { callback(result); return render(); },
        frame() { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback()); render(); },
        unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    };
}
const presentation = (os = 'ios', open = true) => harness('hooks/useTextModerationPresentation.ts', 'useTextModerationPresentation', open, { os, hook: true });

test('iOS hides the editor first and waits for its actual native dismiss before showing the warning', () => {
    const f = presentation(); const rejected = warning('headline');
    f.act(value => value.setModerationWarning(rejected));
    assert.equal(f.value.editorSuspended, true);
    assert.equal(f.value.moderationWarning, null);
    assert.equal(f.frames.size, 0, 'iOS must not replace native dismissal with a frame heuristic');
    f.frame(); assert.equal(f.value.moderationWarning, null);
    f.act(value => value.onEditorDismiss());
    assert.equal(f.value.moderationWarning, rejected);
    f.unmount();
});

test('clearing an iOS warning leaves the editor suspended until the warning native modal dismisses', () => {
    const f = presentation();
    f.act(value => value.setModerationWarning(warning('bio')));
    f.act(value => value.onEditorDismiss());
    f.act(value => value.setModerationWarning(null));
    assert.equal(f.value.moderationWarning, null); assert.equal(f.value.editorSuspended, true);
    f.act(value => value.onEditorDismiss());
    assert.equal(f.value.editorSuspended, true, 'stale editor callback cannot reopen beneath a closing warning');
    f.act(value => value.onWarningDismiss());
    assert.equal(f.value.editorSuspended, false);
    f.unmount();
});

test('Android uses a cancelable frame fallback in both presentation directions', () => {
    const f = presentation('android'); const rejected = warning('company');
    f.act(value => value.setModerationWarning(rejected));
    assert.equal(f.value.moderationWarning, null); assert.equal(f.value.editorSuspended, true);
    assert.equal(f.frames.size, 1);
    f.frame(); assert.equal(f.value.moderationWarning, rejected);
    f.act(value => value.setModerationWarning(null));
    assert.equal(f.value.editorSuspended, true); assert.equal(f.frames.size, 1);
    f.frame(); assert.equal(f.value.editorSuspended, false); assert.equal(f.frames.size, 0);
    f.unmount();
});

for (const os of ['ios', 'android']) {
    test(`${os}: inline warnings with no open drawer do not wait for an editor dismissal`, () => {
        const f = presentation(os, false); const rejected = warning('partner_about');
        f.act(value => value.setModerationWarning(rejected));
        assert.equal(f.value.moderationWarning, rejected); assert.equal(f.frames.size, 0);
        f.act(value => value.setModerationWarning(null));
        assert.equal(f.value.moderationWarning, null);
        if (os === 'ios') f.act(value => value.onWarningDismiss()); else f.frame();
        assert.equal(f.value.editorSuspended, false);
        f.unmount();
    });
}

test('out-of-phase duplicate native dismissal callbacks are no-ops', () => {
    const f = presentation();
    f.act(value => { value.onEditorDismiss(); value.onWarningDismiss(); });
    assert.equal(f.value.editorSuspended, false);
    f.act(value => value.setModerationWarning(warning('bio')));
    f.act(value => value.onWarningDismiss());
    assert.equal(f.value.moderationWarning, null); assert.equal(f.value.editorSuspended, true);
    f.act(value => value.onEditorDismiss()); const shown = f.value.moderationWarning;
    f.act(value => { value.onEditorDismiss(); value.onWarningDismiss(); });
    assert.equal(f.value.moderationWarning, shown);
    f.act(value => value.setModerationWarning(null));
    f.act(value => { value.onWarningDismiss(); value.onWarningDismiss(); });
    assert.equal(f.value.editorSuspended, false);
    f.unmount();
});

test('warnings can be edited and retried repeatedly with the latest field content', () => {
    const f = presentation();
    for (const field of ['headline', 'bio', 'company', 'headline']) {
        const rejected = warning(field);
        f.act(value => value.setModerationWarning(rejected));
        assert.equal(f.value.moderationWarning, null);
        f.act(value => value.onEditorDismiss());
        assert.equal(f.value.moderationWarning, rejected);
        f.act(value => value.setModerationWarning(null));
        f.act(value => value.onWarningDismiss());
        assert.equal(f.value.editorSuspended, false);
    }
    f.unmount();
});

test('canceling a warning before the editor native dismiss never presents the canceled content', () => {
    const f = presentation();
    f.act(value => value.setModerationWarning(warning('bio')));
    f.act(value => value.setModerationWarning(null));
    assert.equal(f.value.editorSuspended, true);
    f.act(value => value.onEditorDismiss());
    assert.equal(f.value.editorSuspended, false); assert.equal(f.value.moderationWarning, null);
    f.act(value => value.onWarningDismiss()); assert.equal(f.value.moderationWarning, null);
    f.unmount();
});

for (const closingWarning of [false, true]) {
    test(`unmount cancels the Android ${closingWarning ? 'warning' : 'editor'} fallback frame`, () => {
        const f = presentation('android');
        f.act(value => value.setModerationWarning(warning('bio')));
        if (closingWarning) { f.frame(); f.act(value => value.setModerationWarning(null)); }
        assert.equal(f.frames.size, 1);
        f.unmount();
        assert.equal(f.frames.size, 0); assert.ok(f.calls.canceledFrames.length > 0);
    });
}

test('Android native dismissal before fallback cancels its now-obsolete scheduled frame', () => {
    const f = presentation('android');
    f.act(value => value.setModerationWarning(warning('company')));
    f.act(value => value.onEditorDismiss());
    assert.equal(f.frames.size, 0);
    f.act(value => value.setModerationWarning(null));
    f.act(value => value.onWarningDismiss());
    assert.equal(f.frames.size, 0); assert.equal(f.value.editorSuspended, false);
    f.unmount();
});

test('WarningModal retains its hidden native Modal and last content to deliver onDismiss', () => {
    let dismissed = 0;
    const f = harness('components/app/TextModerationWarningModal.tsx', 'TextModerationWarningModal', {
        warning: null, submitting: false, onEdit() {}, onSubmitAnyway() {}, onDismiss: () => { dismissed++; },
    });
    assert.equal(f.value, null);
    f.render({ warning: warning('headline') });
    assert.equal(f.find('Modal').props.visible, true);
    const modalType = f.value.type;
    f.render({ warning: null });
    assert.equal(f.value.type, modalType); assert.equal(f.find('Modal').props.visible, false);
    assert.ok(descendants(f.value).some(node => node.type === 'Text' && node.props.children === 'moderation_text_warning_title_headline'));
    f.find('Modal').props.onDismiss(); assert.equal(dismissed, 1);
    f.render({ warning: warning('bio') });
    assert.ok(descendants(f.value).some(node => node.type === 'Text' && node.props.children === 'moderation_text_warning_title_bio'));
    f.unmount();
});

const editorProps = overrides => ({
    visible: true, title: 'Headline', initialValue: 'Original', placeholder: 'Text', maxNonSpace: 200,
    onClose() {}, onSave() {}, ...overrides,
});

for (const variant of ['drawer', 'sheet']) {
    test(`TextEditSheet ${variant} keeps its dirty draft while native presentation is suspended`, () => {
        const saved = []; let dismissed = 0;
        const f = harness('components/ui/TextEditSheet.tsx', 'TextEditSheet', editorProps({
            presentation: variant, onSave: draft => saved.push(draft), onDismiss: () => { dismissed++; },
        }));
        const inputType = variant === 'drawer' ? 'UnderlineTextInput' : 'BottomSheetTextInput';
        f.act(() => f.find(inputType).props.onChangeText('Unsaved draft'));
        f.render({ suspended: true, initialValue: 'New server value' });
        assert.equal(f.find('Modal').props.visible, false);
        assert.equal(f.find(inputType).props.value, 'Unsaved draft');
        f.find('Modal').props.onDismiss(); assert.equal(dismissed, 1);
        if (variant === 'drawer') assert.ok(f.calls.keyboardDismiss > 0);
        f.render({ suspended: false });
        assert.equal(f.find('Modal').props.visible, true);
        assert.equal(f.find(inputType).props.value, 'Unsaved draft');
        f.find('GradientButton').props.onPress();
        assert.deepEqual(saved, ['Unsaved draft']);
        f.unmount();
    });
}

test('successful save closing the owner never reopens the editor after warning dismissal', () => {
    const p = presentation();
    p.act(value => value.setModerationWarning(warning('company')));
    p.act(value => value.onEditorDismiss());
    p.render(false);
    p.act(value => value.setModerationWarning(null));
    const f = harness('components/ui/TextEditSheet.tsx', 'TextEditSheet', editorProps({
        presentation: 'drawer', visible: false, suspended: p.value.editorSuspended,
    }));
    assert.equal(f.find('Modal').props.visible, false);
    p.act(value => value.onWarningDismiss());
    f.render({ suspended: p.value.editorSuspended });
    assert.equal(p.value.editorSuspended, false);
    assert.equal(f.find('Modal').props.visible, false, 'the owner visible prop still wins after suspension is released');
    f.unmount(); p.unmount();
});
