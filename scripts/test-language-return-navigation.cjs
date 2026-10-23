const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, resolve = require, globals = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const context = { exports: {}, require: resolve, ...globals };
    vm.runInNewContext(compiled, context, { filename: file });
    return context.exports;
}
const authReturn = load('lib/authReturn.ts');
const languageNames = load('lib/languageNames.ts');
const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
const flattenStyle = style => Array.isArray(style)
    ? Object.assign({}, ...style.map(flattenStyle)) : style || {};

function assertCheckVisibility(f, visibleLabels, loadingLabel) {
    const rows = f.nodes().filter(node => node.type === 'SettingsNavRow');
    assert.equal(rows.length, languageNames.SUPPORTED_APP_LANGUAGES.length);
    const visible = [];
    for (const row of rows) {
        const accessory = descendants(row.props.accessory);
        assert.equal(accessory.filter(node => node.type === 'Check').length, 1, `${row.props.label}: marker stays mounted`);
        const circle = accessory.find(node => node.type === 'View'
            && React.Children.toArray(node.props.children).some(child => child.type === 'Check'));
        assert.ok(circle, `${row.props.label}: check circle stays mounted`);
        assert.equal(circle.props.pointerEvents, 'none');
        const opacity = flattenStyle(circle.props.style).opacity;
        const expected = row.props.selected && row.props.label !== loadingLabel ? 1 : 0;
        assert.equal(opacity, expected, `${row.props.label}: check opacity follows selection and loading`);
        if (opacity === 1) visible.push(row.props.label);
        const spinners = accessory.filter(node => node.type === 'ActivityIndicator');
        assert.equal(spinners.length, row.props.label === loadingLabel ? 1 : 0);
        if (spinners.length) assert.equal(flattenStyle(spinners[0].props.style).position, 'absolute');
    }
    assert.deepEqual(visible, visibleLabels);
}

function setup({ params = {}, pathname = '/language', currentLanguage = 'en', rootMenu = true, menu = false, changeLanguageImpl } = {}) {
    const actions = [];
    const queued = [];
    const destinations = [];
    const listeners = new Set();
    const states = [];
    const frames = new Map();
    const effects = [];
    const stateWritesAfterUnmount = [];
    let nextFrame = 1;
    let mounted = true;
    let focused = true;
    let focusCallback;
    let cursor = 0;
    let cleanup;
    let tree;
    const props = { params, pathname, currentLanguage };
    const sameDeps = (before, after) => before && after && before.length === after.length
        && before.every((value, index) => Object.is(value, after[index]));
    const closeMenu = () => actions.push('close-menu');
    const router = {
        navigate: href => actions.push(['navigate', href]),
        push: href => actions.push(['push', href]),
        back: () => assert.fail('Language Back must not depend on remounted history'),
        replace: () => assert.fail('Language Back must navigate to the origin tab'),
    };
    const resolve = name => {
        if (name === 'react') return {
            ...React,
            useCallback(callback, deps) {
                const index = cursor++;
                if (!sameDeps(states[index]?.deps, deps)) states[index] = { callback, deps };
                return states[index].callback;
            },
            useEffect(effect, deps) {
                const index = cursor++;
                if (!sameDeps(states[index]?.deps, deps)) {
                    const previous = states[index];
                    states[index] = { deps, cleanup: previous?.cleanup };
                    effects.push(() => {
                        previous?.cleanup?.();
                        states[index].cleanup = effect();
                    });
                }
            },
            useRef(initial) {
                const index = cursor++;
                if (!(index in states)) states[index] = { current: initial };
                return states[index];
            },
            useState(initial) {
                const index = cursor++;
                if (!(index in states)) states[index] = initial;
                return [states[index], value => {
                    if (!mounted) stateWritesAfterUnmount.push(value);
                    states[index] = typeof value === 'function' ? value(states[index]) : value;
                }];
            },
        };
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'expo-router') return {
            router, usePathname: () => props.pathname, useLocalSearchParams: () => props.params,
            useFocusEffect: effect => {
                if (focused && effect !== focusCallback) {
                    cleanup?.();
                    focusCallback = effect;
                    cleanup = effect();
                }
            },
        };
        if (name === 'react-native') return {
            ...Object.fromEntries(['View', 'Pressable', 'ActivityIndicator', 'ScrollView'].map(value => [value, value])),
            StyleSheet: { create: value => value, hairlineWidth: 1,
                absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } },
            BackHandler: { addEventListener: (event, handler) => {
                assert.equal(event, 'hardwareBackPress'); listeners.add(handler);
                return { remove: () => listeners.delete(handler) };
            } },
        };
        if (name === '@/lib/authReturn') return authReturn;
        if (name === '@/lib/languageNames') return languageNames;
        if (name === '@/hooks/useLanguage') return { useLanguage: () => ({
            t: key => key, isRTL: props.currentLanguage === 'ar', currentLanguage: props.currentLanguage,
            changeLanguage: async (code, restorePath) => {
                actions.push(['change-language', code, restorePath]);
                if (changeLanguageImpl) await changeLanguageImpl(code, restorePath);
                props.currentLanguage = code;
            },
        }) };
        if (name === '@/hooks/useToast') return { useToast: () => ({ show: (...args) => actions.push(['toast', ...args]) }) };
        if (name === '@/hooks/useColors') return { useColors: () => ({ chrome: { primary: 'primary' }, brand: { bg: { surface: 'surface' } } }) };
        if (name === '@/hooks/useResponsive') return { scale: value => value };
        if (name === '@/hooks/useTheme') return { useTheme: () => ({ isDark: false }) };
        if (name === '@/hooks/useWebSupport') return { useWebSupport: () => () => {} };
        if (name === '@/store/authStore') return { useAuthStore: () => ({ logout: () => {}, isLoading: false }) };
        if (name === '@/constants/typography') return { fontFamilyForText: () => 'existing-font' };
        if (name === '@/constants/uiTokens') return { NavigationTypeTokens: { drawerTitle: {}, drawerLabel: {} } };
        if (name === '@/constants/releaseFeatures') return { MEMBERSHIP_PURCHASES_ENABLED: false };
        if (name === '@/components/app/RootAppMenuDrawer') return { useRootAppMenu: () => rootMenu ? { closeMenu, openMenu: () => {} } : null };
        if (name === '@/components/settings/SettingsRows') return { SettingsNavRow: 'SettingsNavRow' };
        if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
        if (name === 'phosphor-react-native' || name === '@/components/ui/icons/PhosphorCompat') return new Proxy({}, { get: (_target, key) => key });
        if (name.startsWith('@/components/')) { const component = name.split('/').at(-1); return { [component]: component }; }
        throw new Error(`Unexpected import: ${name}`);
    };
    const Component = menu ? load('components/app/AppMenuDrawer.tsx', resolve).AppMenuDrawerContent
        : load('app/(tabs)/(main)/(profile)/language.tsx', resolve, {
            requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
            cancelAnimationFrame: id => frames.delete(id),
        }).default;
    const render = changes => {
        Object.assign(props, changes);
        cursor = 0;
        tree = Component(menu ? { onClose: () => {}, onCloseThenRun: (action, destination) => {
            queued.push(action);
            destinations.push(destination);
        } } : {});
        effects.splice(0).forEach(effect => effect());
    };
    const runFrame = () => {
        const batch = [...frames];
        frames.clear();
        batch.forEach(([, callback]) => callback());
    };
    const flushFrame = async () => {
        runFrame();
        await Promise.resolve();
    };
    const flushFrames = async () => { await flushFrame(); await flushFrame(); };
    render();
    return {
        actions, queued, destinations, props, render, listeners, frames, runFrame, flushFrame, flushFrames, stateWritesAfterUnmount,
        blur() { focused = false; cleanup?.(); cleanup = undefined; focusCallback = undefined; },
        focus() { focused = true; render(); },
        find: type => descendants(tree).find(node => node.type === type),
        nodes: () => descendants(tree),
        async choose(code) {
            descendants(tree).find(node => node.type === 'SettingsNavRow' && node.props.label === code.toUpperCase()).props.onPress();
            render();
            await flushFrames();
            await new Promise(setImmediate);
            render();
        },
        unmount() {
            mounted = false;
            cleanup?.();
            states.forEach(state => state?.cleanup?.());
        },
    };
}

test('Menu Language waits for drawer closure and passes the Explore pathname as returnTo', () => {
    const f = setup({ menu: true, pathname: '/search' });
    f.nodes().find(node => node.props?.label === 'language').props.onPress();
    assert.equal(f.actions.length, 0);
    assert.equal(f.queued.length, 1);
    assert.deepEqual(f.destinations, ['/language']);
    f.queued.shift()();
    assert.equal(JSON.stringify(f.actions), JSON.stringify([['push', { pathname: '/language', params: { returnTo: '/search' } }]]));
});

for (const [returnTo, expected] of [
    ['/search', '/search'], [['/(tabs)/search', '/profile'], '/search'],
    ['/messages', '/messages'], ['/conversation/abc_123', '/conversation/abc_123'],
    [undefined, '/settings'], [[], '/settings'], ['/language', '/settings'],
    ['https://example.com', '/settings'], ['//example.com', '/settings'],
    ['/(auth)/login', '/settings'], ['/language?returnTo=/search', '/settings'],
    ['/unknown', '/settings'],
]) {
    test(`Language return ${JSON.stringify(returnTo)} navigates to ${expected} after closing root menu`, () => {
        const f = setup({ params: { returnTo } });
        assert.equal(f.find('AppBackTitleBar').props.fallbackHref, expected);
        f.find('AppBackTitleBar').props.onBack();
        assert.deepEqual(f.actions, ['close-menu', ['navigate', expected]]);
        f.actions.length = 0;
        assert.equal([...f.listeners][0](), true);
        assert.deepEqual(f.actions, ['close-menu', ['navigate', expected]]);
        f.unmount();
        assert.equal(f.listeners.size, 0);
    });
}

test('Language Back works without an optional root menu provider', () => {
    const f = setup({ rootMenu: false, params: { returnTo: '/search' } });
    f.find('AppBackTitleBar').props.onBack();
    assert.deepEqual(f.actions, [['navigate', '/search']]);
    f.unmount();
});

test('English/German and RTL reload remounts retain encoded returnTo and Back reaches Explore repeatedly', async () => {
    let f = setup({ params: { returnTo: '/search' } });
    for (const code of ['de', 'en', 'ar', 'de', 'en']) {
        await f.choose(code);
        const change = f.actions.find(action => Array.isArray(action) && action[0] === 'change-language');
        assert.deepEqual(change, ['change-language', code, '/language?returnTo=%2Fsearch']);
        const restore = new URL(change[2], 'https://local.invalid');
        f.unmount();
        f = setup({ pathname: restore.pathname, params: { returnTo: restore.searchParams.get('returnTo') }, currentLanguage: code });
        f.find('AppBackTitleBar').props.onBack();
        assert.deepEqual(f.actions, ['close-menu', ['navigate', '/search']]);
        f.actions.length = 0;
    }
    f.unmount();
});

test('changeLanguage restoration path uses a sanitized default, not raw untrusted query', async () => {
    const f = setup({ params: { returnTo: '/language' } });
    await f.choose('ar');
    assert.deepEqual(f.actions, [['change-language', 'ar', '/language?returnTo=%2Fsettings']]);
    f.unmount();
});

test('selecting the already-active language does not trigger a reload', async () => {
    const f = setup({ params: { returnTo: '/search' } });
    await f.choose('en');
    assert.deepEqual(f.actions, []);
    f.unmount();
});

test('DE/EN switches keep all check circles mounted with exactly one visible selected marker', async () => {
    const f = setup();
    for (const code of ['en', 'de', 'en', 'de', 'en']) {
        await f.choose(code);
        const rows = f.nodes().filter(node => node.type === 'SettingsNavRow');
        assert.equal(rows.length, languageNames.SUPPORTED_APP_LANGUAGES.length);
        assert.deepEqual(rows.filter(row => row.props.selected).map(row => row.props.label), [code.toUpperCase()]);
        assert.ok(rows.every(row => row.props.animatePress === false));
        assertCheckVisibility(f, [code.toUpperCase()]);
        assert.ok(rows.every(row => !row.props.disabled));
    }
    f.unmount();
});

test('synchronous duplicate taps are suppressed before rerender and pending rows stay disabled', async () => {
    let finish;
    const gate = new Promise(resolve => { finish = resolve; });
    const f = setup({ changeLanguageImpl: () => gate });
    const rows = f.nodes().filter(node => node.type === 'SettingsNavRow');
    rows.find(row => row.props.label === 'DE').props.onPress();
    rows.find(row => row.props.label === 'FR').props.onPress();
    rows.find(row => row.props.label === 'DE').props.onPress();
    assert.equal(f.actions.filter(action => action[0] === 'change-language').length, 0);
    f.render();
    assert.ok(f.nodes().filter(node => node.type === 'SettingsNavRow').every(row => row.props.disabled));
    assertCheckVisibility(f, ['EN'], 'DE');
    await f.flushFrames();
    assert.equal(f.actions.filter(action => action[0] === 'change-language').length, 1);
    // The real store publishes the new LTR selection before its storage promise settles.
    f.render({ currentLanguage: 'de' });
    assertCheckVisibility(f, [], 'DE');
    assert.deepEqual(f.nodes().filter(node => node.type === 'SettingsNavRow' && node.props.selected).map(row => row.props.label), ['DE']);
    finish();
    await new Promise(setImmediate);
    f.render();
    assertCheckVisibility(f, ['DE']);
    await f.choose('en');
    assertCheckVisibility(f, ['EN']);
    assert.deepEqual(f.actions.filter(action => action[0] === 'change-language').map(action => action[1]), ['de', 'en']);
    f.unmount();
});

test('failed language changes show the translated error and release the single-flight guard for retry', async () => {
    let attempts = 0;
    const f = setup({ changeLanguageImpl: async () => {
        if (++attempts === 1) throw new Error('storage unavailable');
    } });
    await f.choose('de');
    assert.deepEqual(f.actions.find(action => action[0] === 'toast'), ['toast', 'something_went_wrong', 'error']);
    assert.equal(f.props.currentLanguage, 'en');
    assertCheckVisibility(f, ['EN']);
    assert.ok(f.nodes().filter(node => node.type === 'SettingsNavRow').every(row => !row.props.disabled));
    await f.choose('de');
    assert.equal(attempts, 2);
    assert.equal(f.props.currentLanguage, 'de');
    assertCheckVisibility(f, ['DE']);
    f.unmount();
});

test('spinner renders before translation and changeLanguage waits for both distinct frames', async () => {
    const f = setup();
    f.nodes().find(node => node.type === 'SettingsNavRow' && node.props.label === 'DE').props.onPress();
    f.render();
    assertCheckVisibility(f, ['EN'], 'DE');
    assert.equal(f.props.currentLanguage, 'en');
    assert.deepEqual(f.actions, []);
    assert.equal(f.frames.size, 1);
    await f.flushFrame();
    f.render();
    assertCheckVisibility(f, ['EN'], 'DE');
    assert.deepEqual(f.actions, [], 'first frame must not start synchronous translation work');
    assert.equal(f.frames.size, 1, 'second frame remains scheduled across rerender');
    await f.flushFrame();
    await new Promise(setImmediate);
    f.render();
    assert.deepEqual(f.actions, [['change-language', 'de', '/language?returnTo=%2Fsettings']]);
    assertCheckVisibility(f, ['DE']);
    assert.equal(f.frames.size, 0);
    f.unmount();
});

for (const exit of ['blur', 'unmount']) {
    for (const elapsedFrames of [0, 1]) {
        test(`${exit} ${elapsedFrames ? 'between frames' : 'before first frame'} cancels translation feedback safely`, async () => {
            const f = setup();
            f.nodes().find(node => node.type === 'SettingsNavRow' && node.props.label === 'DE').props.onPress();
            f.render();
            if (elapsedFrames) await f.flushFrame();
            assert.equal(f.frames.size, 1);
            f[exit]();
            assert.equal(f.frames.size, 0, 'latest pending frame must be canceled');
            await f.flushFrames();
            await new Promise(setImmediate);
            assert.deepEqual(f.actions, [], 'canceled feedback must not translate or toast');
            assert.deepEqual(f.stateWritesAfterUnmount, []);
            assert.equal(f.listeners.size, 0);
            if (exit === 'blur') {
                f.focus();
                assertCheckVisibility(f, ['EN']);
                assert.ok(f.nodes().filter(node => node.type === 'SettingsNavRow').every(row => !row.props.disabled));
                await f.choose('de');
                assertCheckVisibility(f, ['DE']);
                assert.equal(f.actions.filter(action => action[0] === 'change-language').length, 1);
                f.unmount();
            }
        });
    }
}

for (const refocusBeforeContinuation of [false, true]) {
    test(`blur after frame two resolves but before continuation${refocusBeforeContinuation ? ', then refocus,' : ''} invalidates the old selection`, async () => {
        const f = setup();
        f.nodes().find(node => node.type === 'SettingsNavRow' && node.props.label === 'DE').props.onPress();
        f.render();
        await f.flushFrame();
        assert.equal(f.frames.size, 1);
        // Resolve feedback synchronously, leaving its await continuation in the microtask queue.
        f.runFrame();
        assert.equal(f.frames.size, 0);
        assert.deepEqual(f.actions, []);
        f.blur();
        if (refocusBeforeContinuation) f.focus();
        await new Promise(setImmediate);
        assert.deepEqual(f.actions, [], 'the old focus session must never start changeLanguage');
        assert.equal(f.props.currentLanguage, 'en');
        if (!refocusBeforeContinuation) f.focus();
        f.render();
        assertCheckVisibility(f, ['EN']);
        assert.ok(f.nodes().filter(node => node.type === 'SettingsNavRow').every(row => !row.props.disabled));
        await f.choose('de');
        assertCheckVisibility(f, ['DE']);
        assert.equal(f.actions.filter(action => action[0] === 'change-language').length, 1);
        f.unmount();
    });
}

for (const outcome of ['success', 'error']) {
    test(`late async ${outcome} after unmount causes no toast or component state write`, async () => {
        let finish;
        let fail;
        const gate = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
        const f = setup({ changeLanguageImpl: () => gate });
        f.nodes().find(node => node.type === 'SettingsNavRow' && node.props.label === 'DE').props.onPress();
        f.render();
        await f.flushFrames();
        assert.equal(f.actions.filter(action => action[0] === 'change-language').length, 1);
        f.unmount();
        if (outcome === 'success') finish();
        else fail(new Error('late persistence failure'));
        await new Promise(setImmediate);
        assert.deepEqual(f.stateWritesAfterUnmount, []);
        assert.equal(f.actions.filter(action => action[0] === 'toast').length, 0);
        assert.equal(f.listeners.size, 0);
        assert.equal(f.frames.size, 0);
    });
}

test('shared SettingsNavRow keeps animation by default but native mode omits activeScale', () => {
    const { SettingsNavRow } = load('components/settings/SettingsRows.tsx', name => {
        if (name === 'react' || name === 'react/jsx-runtime') return require(name);
        if (name === 'react-native') return {
            View: 'View', Pressable: 'Pressable', Switch: 'Switch', ActivityIndicator: 'ActivityIndicator',
            StyleSheet: { create: value => value, hairlineWidth: 1 },
        };
        if (name === '@/components/ui/PressableScale') return { PressableScale: 'PressableScale' };
        if (name === '@/components/ui/Text') return { Text: 'Text' };
        if (name === '@/components/ui/icons/PhosphorCompat') return { ChevronLeft: 'ChevronLeft', ChevronRight: 'ChevronRight', Lock: 'Lock' };
        if (name === '@/hooks/useColors') return { useColors: () => ({
            chrome: { common: { primaryTint: 'tint', textStrong: 'text' }, header: { iconBackground: 'icon' } },
            brand: { bg: { border: 'border' }, text: { subtitle: 'subtitle', muted: 'muted' } },
        }) };
        if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL: false }) };
        if (name === '@/hooks/useToast') return { useToast: () => ({ show() {} }) };
        if (name === '@/hooks/useResponsive') return { scale: value => value };
        if (name === '@/lib/profileDisplay') return { t: key => key, translateCountry: code => code };
        throw new Error(`Unexpected SettingsNavRow import: ${name}`);
    });
    const onPress = () => {};
    const base = { label: 'EN', icon: null, onPress, selected: true, disabled: true };
    const animated = descendants(SettingsNavRow(base)).find(node => node.type === 'PressableScale');
    assert.equal(animated.props.activeScale, 0.97);
    const plainTree = descendants(SettingsNavRow({ ...base, animatePress: false }));
    assert.ok(!plainTree.some(node => node.type === 'PressableScale'));
    const plain = plainTree.find(node => node.type === 'Pressable');
    assert.equal(Object.hasOwn(plain.props, 'activeScale'), false);
    assert.equal(plain.props.onPress, onPress);
    assert.equal(plain.props.accessibilityState.selected, true);
    assert.equal(plain.props.accessibilityState.disabled, true);
    assert.equal(plain.props.accessibilityLabel, 'EN');
});

function setupNativeTabs(os) {
    let language = 'en';
    const translations = Object.fromEntries(languageNames.SUPPORTED_APP_LANGUAGES.map(({ code }) => [code,
        JSON.parse(fs.readFileSync(path.join(__dirname, `../locales/${code}/common.json`), 'utf8')),
    ]));
    const elements = Object.fromEntries(['Label', 'Icon', 'Badge', 'VectorIcon'].map(name => [`NativeTabsTrigger${name}`, () => null]));
    // Exercise the installed router's label-to-title conversion, not a replacement implementation.
    const { NativeTabTrigger, convertTabPropsToOptions } = load('node_modules/expo-router/build/native-tabs/NativeTabTrigger.js', name => {
        if (name === 'react') return React;
        if (name === 'react-native') return { StyleSheet: { flatten: value => value } };
        if (name === './common/elements') return elements;
        if (name === './utils/optionsIconConverter') return { appendIconOptions: () => {} };
        if (name === '../utils/children') return {
            filterAllowedChildrenElements: (children, allowed) => React.Children.toArray(children).filter(child => allowed.includes(child.type)),
            isChildOfType: (child, type) => child.type === type,
        };
        if (['../react-navigation/native', '../link/preview/PreviewRouteContext', '../useFocusEffect'].includes(name)) return {};
        throw new Error(`Unexpected router import: ${name}`);
    });
    const NativeTabs = Object.assign(() => null, { Trigger: NativeTabTrigger });
    const { default: TabsLayout } = load('app/(tabs)/(main)/_layout.tsx', name => {
        if (name === 'react') return { ...React, useEffect: () => {}, useState: initial => [initial, () => {}] };
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react-native') return {
            Platform: { OS: os }, View: 'View', Text: 'NativeText',
            StyleSheet: { create: value => value, absoluteFill: {}, hairlineWidth: 1 },
            useWindowDimensions: () => ({ width: 390, height: 844 }),
        };
        if (name === 'expo-router/unstable-native-tabs') return { NativeTabs };
        if (name === 'expo-router') return { router: { prefetch: () => assert.fail('Idle prefetch must not run in render') } };
        if (name === 'expo-image') return { Image: 'Image' };
        if (name === '@tanstack/react-query') return { useQuery: () => ({}), useQueryClient: () => ({}) };
        if (name === 'phosphor-react-native') return { User: 'User' };
        if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 34 }) };
        if (name === '@/hooks/useLanguage') return { useLanguage: () => ({
            currentLanguage: language, isRTL: language === 'ar', t: key => translations[language][key],
        }) };
        if (name === '@/hooks/useColors') return { useColors: () => ({ chrome: { tabBar: {}, common: {}, badge: {} } }) };
        if (name === '@/hooks/usePeriodicLocationRefresh') return { usePeriodicLocationRefresh: () => {} };
        if (name === '@/hooks/useChatSocket') return { useChatSocket: () => {} };
        if (name === '@/store/authStore') return { useAuthStore: selector => selector({ user: null, patchUserProfile: () => {} }) };
        if (name === '@/constants/typography') return { Typography: { font: { body: { medium: 'body-medium', bold: 'body-bold' }, arabic: { semi: 'arabic-semi', bold: 'arabic-bold' } } } };
        if (name === '@/constants/uiTokens') return { NavigationTypeTokens: { tabLabel: { fontSize: 11, selectedFontSize: 11 } }, formatBadgeCount: String };
        if (name === '@/lib/queryKeys') return { queryKeys: { chat: { unreadCount: ['unread'] }, profile: { mySummary: ['summary'] }, gallery: { me: ['gallery'] } } };
        if (name === '@/lib/profileDisplay') return { profileAvatarImage: () => '' };
        if (name === '@/lib/galleryService') return { galleryService: { fetchMe: () => {} } };
        if (['@/lib/profileService', '@/lib/chatService', '@/lib/idleWork'].includes(name)) return {};
        if (name.endsWith('.png')) return name;
        if (name.startsWith('@/components/')) { const component = name.split('/').at(-1); return { [component]: component }; }
        throw new Error(`Unexpected tabs import: ${name}`);
    });
    return {
        translations,
        render(code) {
            language = code;
            const tree = TabsLayout();
            const navigator = descendants(tree).find(node => node.type === NativeTabs);
            const triggers = React.Children.toArray(navigator.props.children);
            const tabs = Object.fromEntries(triggers.map(trigger => [trigger.props.name, {
                type: trigger.type, key: trigger.key,
                title: convertTabPropsToOptions(trigger.props).title,
            }]));
            return { navigator, tabs };
        },
    };
}

for (const os of ['ios', 'android']) {
    test(`${os}: same-direction language changes preserve native navigator/tab identity while updating all labels`, () => {
        const f = setupNativeTabs(os);
        const first = f.render('en');
        assert.equal(first.navigator.key, null, 'NativeTabs must not be keyed by language');
        const labelKeys = { search: 'explore', '(messages)': 'messages', activities: 'activities', '(profile)': 'profile' };
        for (const code of ['de', 'en', 'fr', 'es', 'id', 'it', 'pl', 'pt', 'ru', 'tr', 'de', 'en']) {
            const next = f.render(code);
            assert.equal(next.navigator.type, first.navigator.type);
            assert.equal(next.navigator.key, first.navigator.key, 'A changed navigator key would remount the Language screen');
            assert.equal(next.navigator.props.backBehavior, 'history');
            assert.deepEqual(Object.keys(next.tabs), Object.keys(first.tabs));
            for (const [name, translationKey] of Object.entries(labelKeys)) {
                assert.equal(next.tabs[name].type, first.tabs[name].type);
                assert.equal(next.tabs[name].key, first.tabs[name].key);
                assert.equal(next.tabs[name].title, f.translations[code][translationKey]);
            }
        }
        assert.notEqual(f.render('de').tabs.search.title, first.tabs.search.title);
    });
}
