const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '..');
const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};

function setup(file = 'components/app/RootAppMenuDrawer.tsx', exported = 'RootAppMenuDrawer', options = {}) {
    const hooks = [];
    const effects = [];
    const frames = new Map();
    let cursor = 0;
    let dirty = false;
    let frameId = 0;
    let diagnosticId = 0;
    let tree;
    const state = {
        os: 'android', pathname: '/search', segments: ['(tabs)', '(main)', 'search'],
        currentLanguage: 'en', isRTL: false, isDark: false, user: { _id: 'owner-a' },
        isLoading: false, calls: [], queued: [], routes: [], marks: [],
        destinations: [], diagnostics: [], diagnosticsEnabled: true,
        ...options,
    };
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
    const mockReact = {
        ...React,
        createContext: initial => ({ Provider: 'ContextProvider', initial }),
        useContext: context => state.contextValue ?? context.initial,
        useRef(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = { current: initial };
            return hooks[index];
        },
        useState(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
            return [hooks[index], value => {
                const next = typeof value === 'function' ? value(hooks[index]) : value;
                if (!Object.is(next, hooks[index])) { hooks[index] = next; dirty = true; }
            }];
        },
        useMemo(factory, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) hooks[index] = { deps, value: factory() };
            return hooks[index].value;
        },
        useCallback(callback, deps) { return mockReact.useMemo(() => callback, deps); },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) effects.push(() => {
                hooks[index]?.cleanup?.();
                hooks[index] = { deps, cleanup: effect() };
            });
        },
    };
    const auth = {
        get user() { return state.user; },
        get isLoading() { return state.isLoading; },
        logout: async () => state.calls.push('logout'),
    };
    const authStore = selector => selector ? selector(auth) : auth;
    authStore.getState = () => auth;
    const delegate = {
        openMenu: () => state.calls.push('delegate-open'),
        closeMenu: () => state.calls.push('delegate-close'),
    };
    const context = {
        exports: {},
        requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        require(name) {
            if (name === 'react') return mockReact;
            if (name === 'react/jsx-runtime') return require(name);
            if (name === 'react-native') return {
                View: 'View', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator',
                Platform: { OS: state.os }, useWindowDimensions: () => ({ width: 390, height: 844 }),
                StyleSheet: { create: value => value, hairlineWidth: 0.5, absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
            };
            if (name === 'expo-router') return {
                Slot: 'Slot', usePathname: () => state.pathname, useSegments: () => state.segments,
                router: { push: destination => state.routes.push(destination), replace: destination => state.routes.push(destination) },
                useNavigation() { assert.fail('A nested drawer must not be consulted'); },
            };
            if (name === 'expo-router/drawer' || name === 'react-native-drawer-layout'
                || name === 'react-native-gesture-handler/ReanimatedDrawerLayout') {
                assert.fail('App menu must not import a Drawer engine');
            }
            if (name === 'react-native-gesture-handler') return {
                GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView',
                Gesture: { Pan() {
                    const gesture = { config: {} };
                    for (const method of ['enabled', 'hitSlop', 'activeOffsetX', 'failOffsetY', 'onEnd']) {
                        gesture[method] = value => { gesture.config[method] = value; return gesture; };
                    }
                    return gesture;
                } },
            };
            if (name === 'react-native-reanimated') return { runOnJS: callback => callback };
            if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL: state.isRTL, currentLanguage: state.currentLanguage, t: key => key }) };
            if (name === '@/hooks/useTheme') return { useTheme: () => ({ isDark: state.isDark }) };
            if (name === '@/hooks/useWebSupport') return { useWebSupport: () => () => state.calls.push('support') };
            if (name === '@/hooks/useResponsive') return { scale: value => value };
            if (name === '@/store/authStore') return { useAuthStore: authStore };
            if (name === '@/lib/performanceDiagnostics') return {
                markInteraction: (...args) => state.marks.push(args),
                completeInteraction: (...args) => state.marks.push(args),
            };
            if (name === '@/lib/menuNavigationDiagnostics') return {
                beginMenuNavigation(destination) {
                    const id = state.diagnosticsEnabled ? ++diagnosticId : undefined;
                    state.diagnostics.push(['begin', destination, id]);
                    return id;
                },
                markMenuNavigation: (id, phase) => state.diagnostics.push(['mark', id, phase]),
                cancelMenuNavigation: id => state.diagnostics.push(['cancel', id]),
            };
            if (name === './RootAppMenuDrawer' || name === '@/components/app/RootAppMenuDrawer') return { useRootAppMenu: () => delegate };
            if (name === '@/components/app/AppMenuDrawer') return { AppMenuDrawerContent: 'AppMenuDrawerContent' };
            if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView', SafeAreaProvider: 'SafeAreaProvider' };
            if (name === '@/components/ui/Text') return { Text: 'Text' };
            if (name === '@/components/ui/icons/PhosphorCompat') return { PencilLine: 'PencilLine', X: 'X' };
            if (name === 'phosphor-react-native') return Object.fromEntries(['CreditCard', 'GearSix', 'HandHeart', 'Plant', 'Prohibit', 'SealCheck', 'ShieldWarning', 'SignOut', 'Translate', 'User'].map(icon => [icon, icon]));
            if (name === '@/constants/typography') return { fontFamilyForText: () => 'existing-font' };
            if (name === '@/constants/uiTokens') return { NavigationTypeTokens: { drawerTitle: {}, drawerLabel: {} } };
            if (name === '@/constants/releaseFeatures') return { MEMBERSHIP_PURCHASES_ENABLED: false };
            throw new Error('Unexpected import: ' + name);
        },
    };
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText, context, { filename: file });
    const props = {
        children: React.createElement('AppChildren'),
        onClose: () => state.calls.push('content-close'),
        onCloseThenRun: (action, destination) => {
            state.queued.push(action);
            state.destinations.push(destination);
        }, isNavigating: false,
        ...options.props,
    };
    const find = type => descendants(tree).find(node => node.type === type);
    const render = (changes = {}) => {
        Object.assign(props, changes);
        let passes = 0;
        do {
            assert.ok(passes++ < 25, 'Menu effects must settle');
            dirty = false; cursor = 0;
            tree = context.exports[exported](props);
            while (effects.length) effects.shift()();
        } while (dirty);
        return tree;
    };
    const flushFrames = () => {
        const callbacks = [...frames.values()];
        frames.clear();
        for (const callback of callbacks) callback();
        render();
    };
    render();
    return {
        state, props, render, find, frames, flushFrames,
        value: () => find('ContextProvider').props.value,
        modal: () => find('Modal'),
        content: () => find('AppMenuDrawerContent'),
        gesture: () => find('GestureDetector').props.gesture.config,
        closeGesture: () => descendants(find('Modal')).find(node => node.type === 'GestureDetector')?.props.gesture.config,
        backdrop: () => descendants(find('Modal')).find(node => node.type === 'Pressable'),
        nodes: () => descendants(tree),
        open(show = true) {
            find('ContextProvider').props.value.openMenu(); render();
            assert.equal(find('Modal').props.visible, true);
            if (show) { find('Modal').props.onShow(); render(); }
        },
        finishClose() {
            if (state.os === 'ios') { find('Modal').props.onDismiss(); render(); }
            else flushFrames();
        },
        unmount() { for (const hook of hooks) hook?.cleanup?.(); },
    };
}

for (const os of ['android', 'ios']) {
    test(os + ': only accepted navigation starts an ID and marks actual dispatch once before the action', () => {
        const f = setup(undefined, undefined, { os }); f.open(false);
        const queue = f.content().props.onCloseThenRun;
        queue(() => f.state.diagnostics.push(['action', '/language']), '/language');
        queue(() => assert.fail('Duplicate action must be ignored'), '/settings');
        f.render();
        assert.deepEqual(f.state.diagnostics, [['begin', '/language', 1]]);
        f.modal().props.onShow(); f.render();
        assert.deepEqual(f.state.diagnostics, [['begin', '/language', 1]]);
        f.finishClose(); f.finishClose();
        assert.deepEqual(f.state.diagnostics.filter(event => event[0] !== 'cancel'), [
            ['begin', '/language', 1], ['mark', 1, 'close_ready'], ['mark', 1, 'dispatch'], ['action', '/language'],
        ]);
        assert.ok(!f.state.diagnostics.some(event => event[0] === 'cancel' && event[1] === 1));
        f.open();
        f.content().props.onCloseThenRun(() => f.state.diagnostics.push(['action', '/settings']), '/settings');
        f.render(); f.finishClose();
        assert.deepEqual(f.state.diagnostics.slice(-4), [
            ['begin', '/settings', 2], ['mark', 2, 'close_ready'], ['mark', 2, 'dispatch'], ['action', '/settings'],
        ]);
    });

    test(os + ': optional diagnostics never gate an accepted action', () => {
        const f = setup(undefined, undefined, { os, diagnosticsEnabled: false }); f.open();
        f.content().props.onCloseThenRun(() => f.state.routes.push('/settings'), '/settings');
        f.render(); f.finishClose();
        assert.deepEqual(f.state.routes, ['/settings']);
        assert.deepEqual(f.state.diagnostics, [
            ['begin', '/settings', undefined], ['mark', undefined, 'close_ready'], ['mark', undefined, 'dispatch'],
        ]);
    });

    for (const reason of ['close', 'scope', 'unmount']) {
        test(os + ': ' + reason + ' cancels the pending diagnostic ID without dispatch or stale restart', () => {
            const f = setup(undefined, undefined, { os }); f.open();
            const queue = f.content().props.onCloseThenRun;
            queue(() => assert.fail('Canceled action must not run'), '/language');
            f.render();
            const dismiss = f.modal().props.onDismiss;
            const frame = [...f.frames.values()][0];
            if (reason === 'close') { f.value().closeMenu(); f.render(); }
            else if (reason === 'scope') { f.state.currentLanguage = 'de'; f.render(); }
            else f.unmount();
            dismiss(); frame?.();
            if (reason !== 'unmount') { f.render(); f.finishClose(); }
            else queue(() => assert.fail('Unmounted callback must be ignored'), '/settings');
            assert.deepEqual(f.state.diagnostics.filter(event => event[0] === 'begin'), [['begin', '/language', 1]]);
            assert.deepEqual(f.state.diagnostics.filter(event => event[0] === 'cancel' && event[1] !== undefined), [['cancel', 1]]);
            assert.deepEqual(f.state.diagnostics.filter(event => event[0] === 'mark'), []);
        });
    }

    test(os + ': a callback accepted after the drawer is closed marks synchronous dispatch without an extra close', () => {
        const f = setup(undefined, undefined, { os }); f.open();
        const queue = f.content().props.onCloseThenRun;
        f.value().closeMenu(); f.render(); f.finishClose();
        f.state.diagnostics.length = 0;
        queue(() => f.state.diagnostics.push(['action']), '/profile');
        assert.deepEqual(f.state.diagnostics, [
            ['begin', '/profile', 1], ['mark', 1, 'close_ready'], ['mark', 1, 'dispatch'], ['action'],
        ]);
    });

    test(os + ': support and logout callbacks never start a navigation measurement', () => {
        const f = setup(undefined, undefined, { os });
        for (const action of ['support', 'logout']) {
            f.open();
            f.content().props.onCloseThenRun(() => f.state.calls.push(action));
            f.render(); f.finishClose();
        }
        assert.deepEqual(f.state.calls, ['support', 'logout']);
        assert.deepEqual(f.state.diagnostics.filter(event => event[0] === 'begin'), []);
        assert.ok(f.state.diagnostics.every(event => event[1] === undefined));
    });

    test(os + ': closed modal has no menu children or stale panel touch surface; open panel is static', () => {
        const f = setup(undefined, undefined, { os });
        assert.equal(f.modal().props.visible, false);
        assert.equal(f.content(), undefined);
        assert.equal(descendants(f.modal()).filter(node => node !== f.modal()).length, 0);
        assert.equal(f.find('SafeAreaProvider'), undefined);
        assert.ok(f.find('AppChildren'));
        f.open();
        assert.equal(f.modal().props.transparent, true);
        assert.equal(f.modal().props.animationType, os === 'ios' ? 'fade' : 'none');
        assert.equal(f.modal().props.statusBarTranslucent, true);
        assert.equal(f.modal().props.navigationBarTranslucent, true);
        assert.ok(f.find('SafeAreaProvider'));
        assert.ok(f.content());
        for (const node of f.nodes()) {
            const style = flatten(node.props?.style);
            assert.equal(style.transform, undefined, 'Menu surfaces must not use translated transforms');
            assert.equal(node.props?.entering, undefined);
        }
        const panel = f.nodes().find(node => node.type === 'View' && flatten(node.props.style).width === 390 * 0.86);
        assert.ok(panel);
        assert.equal(flatten(panel.props.style).position, 'absolute');
        assert.equal(flatten(panel.props.style).right, 0);
        f.value().closeMenu(); f.render();
        assert.equal(f.modal().props.visible, false);
        assert.equal(f.content(), undefined);
        assert.equal(f.find('SafeAreaProvider'), undefined);
        assert.equal(descendants(f.modal()).filter(node => node !== f.modal()).length, 0);
        f.finishClose();
    });

    test(os + ': quick open and row tap before onShow waits for platform close completion and executes once', () => {
        const f = setup(undefined, undefined, { os });
        f.open(false);
        const queue = f.content().props.onCloseThenRun;
        queue(() => f.state.routes.push('/settings'));
        queue(() => f.state.routes.push('/duplicate'));
        f.render();
        assert.equal(f.modal().props.visible, false);
        assert.equal(f.content(), undefined);
        assert.deepEqual(f.state.routes, []);
        f.modal().props.onShow(); f.render();
        assert.deepEqual(f.state.routes, [], 'Late onShow must not dispatch or reopen');
        assert.equal(f.modal().props.visible, false);
        if (os === 'ios') {
            assert.equal(f.frames.size, 0, 'iOS must wait for actual native onDismiss');
            f.flushFrames();
            assert.deepEqual(f.state.routes, []);
        } else assert.equal(f.frames.size, 1, 'Android finishes after its no-animation removal commit');
        f.finishClose(); f.finishClose();
        assert.deepEqual(f.state.routes, ['/settings']);
    });

    for (const cancel of ['X', 'backdrop', 'native Back']) {
        test(os + ': ' + cancel + ' cancels pending navigation and a later session still works', () => {
            const f = setup(undefined, undefined, { os }); f.open();
            const content = f.content();
            const backdrop = f.backdrop();
            content.props.onCloseThenRun(() => f.state.routes.push('/canceled'));
            // A cancellation may arrive before the queued close commit removes the content.
            if (cancel === 'X') content.props.onClose();
            else if (cancel === 'backdrop') backdrop.props.onPress();
            else f.modal().props.onRequestClose();
            f.render(); f.finishClose();
            assert.deepEqual(f.state.routes, []);
            f.open();
            assert.equal(f.content().props.isNavigating, false);
            f.content().props.onCloseThenRun(() => f.state.routes.push('/fresh'));
            f.render(); f.finishClose();
            assert.deepEqual(f.state.routes, ['/fresh']);
        });
    }

    for (const scope of ['pathname', 'currentLanguage', 'isRTL', 'user']) {
        test(os + ': ' + scope + ' change cancels scoped pending navigation before a late completion', () => {
            const f = setup(undefined, undefined, { os }); f.open();
            f.content().props.onCloseThenRun(() => f.state.routes.push('/wrong-scope'));
            f.render();
            const staleDismiss = f.modal().props.onDismiss;
            const staleFrame = [...f.frames.values()][0];
            f.state[scope] = scope === 'user' ? null : scope === 'isRTL' ? true : scope === 'pathname' ? '/profile' : 'de';
            f.render();
            staleDismiss();
            staleFrame?.();
            f.render(); f.finishClose();
            assert.deepEqual(f.state.routes, []);
            f.open();
            assert.equal(f.content().props.isNavigating, false);
        });
    }

    test(os + ': stale dismissal/frame after a completed close cannot close a reopened session', () => {
        const f = setup(undefined, undefined, { os }); f.open();
        const staleDismiss = f.modal().props.onDismiss;
        f.value().closeMenu(); f.render();
        const staleFrame = [...f.frames.values()][0];
        f.finishClose(); f.open();
        staleDismiss(); staleFrame?.(); f.render();
        assert.equal(f.modal().props.visible, true);
        assert.ok(f.content());
        f.content().props.onCloseThenRun(() => f.state.routes.push('/reopened'));
        f.render(); f.finishClose();
        assert.deepEqual(f.state.routes, ['/reopened']);
    });

    test(os + ': unmount cancels scheduled close work and late callbacks cannot navigate', () => {
        const f = setup(undefined, undefined, { os }); f.open();
        f.content().props.onCloseThenRun(() => f.state.routes.push('/stale'));
        f.render();
        const dismiss = f.modal().props.onDismiss;
        const frame = [...f.frames.values()][0];
        f.unmount();
        assert.equal(f.frames.size, 0);
        dismiss(); frame?.();
        assert.deepEqual(f.state.routes, []);
    });

    test(os + ': Explore to Language, German, Back to profile, Explore and Language repeats with fresh menu targets', () => {
        const f = setup(undefined, undefined, { os });
        const contents = new Set();
        for (const language of ['de', 'en', 'de']) {
            f.open();
            contents.add(f.content());
            f.content().props.onCloseThenRun(() => f.state.routes.push('/language'));
            f.render();
            assert.equal(f.content(), undefined);
            assert.equal(f.modal().props.visible, false);
            const before = f.state.routes.length;
            f.finishClose(); f.finishClose();
            assert.equal(f.state.routes.length, before + 1);
            f.state.pathname = '/language'; f.render();
            f.state.currentLanguage = language; f.render();
            f.state.pathname = '/profile'; f.render();
            f.state.pathname = '/search'; f.render();
            assert.equal(f.content(), undefined);
        }
        assert.equal(contents.size, 3, 'Each open must create fresh menu content elements');
        assert.deepEqual(f.state.routes, ['/language', '/language', '/language']);
        f.open();
        assert.equal(f.content().props.isNavigating, false);
    });
}

for (const os of ['android', 'ios']) {
    for (const [label, segments, user] of [
        ['authenticated tabs', ['(tabs)', '(main)', 'search'], { _id: 'owner-a' }],
        ['logged-out tabs', ['(tabs)', '(main)', 'search'], null],
        ['auth', ['(auth)', 'login'], { _id: 'owner-a' }],
        ['onboarding', ['(profile-setup)', 'step2'], { _id: 'owner-a' }],
        ['outside page', ['support'], { _id: 'owner-a' }],
    ]) {
        test(os + '/' + label + ': only authenticated Android tabs enable edge swipe opening', () => {
            const f = setup(undefined, undefined, { os, segments, user });
            assert.equal(f.gesture().enabled, os === 'android' && label === 'authenticated tabs');
            f.open();
            assert.equal(f.gesture().enabled, false, 'An open modal disables the underlying edge opener');
            assert.equal(f.closeGesture().enabled, os === 'android');
        });
    }
}

for (const isRTL of [false, true]) {
    test('Android RTL=' + isRTL + ': correct edge and successful inward threshold open a static panel', () => {
        const f = setup(undefined, undefined, { isRTL });
        const gesture = f.gesture();
        assert.equal(gesture.hitSlop.width, 28);
        assert.equal(gesture.hitSlop[isRTL ? 'left' : 'right'], 0);
        assert.equal(gesture.activeOffsetX, isRTL ? 24 : -24);
        assert.deepEqual([...gesture.failOffsetY], [-24, 24]);
        gesture.onEnd({ translationX: isRTL ? -60 : 60 }, true); f.render();
        assert.equal(f.modal().props.visible, false);
        gesture.onEnd({ translationX: isRTL ? 24 : -24 }, true); f.render();
        assert.equal(f.modal().props.visible, false);
        gesture.onEnd({ translationX: isRTL ? 60 : -60 }, false); f.render();
        assert.equal(f.modal().props.visible, false);
        gesture.onEnd({ translationX: isRTL ? 60 : -60 }, true); f.render();
        assert.equal(f.modal().props.visible, true);
        const panel = f.nodes().find(node => node.type === 'View' && flatten(node.props.style).position === 'absolute');
        assert.equal(flatten(panel.props.style)[isRTL ? 'left' : 'right'], 0);
        assert.equal(flatten(panel.props.style).transform, undefined);
    });
}

test('Android route and auth changes update the edge opener eligibility', () => {
    const f = setup();
    assert.equal(f.gesture().enabled, true);
    f.state.segments = ['(profile-setup)', 'step2']; f.render();
    assert.equal(f.gesture().enabled, false);
    f.state.segments = ['(tabs)', '(main)', 'search']; f.state.user = null; f.render();
    assert.equal(f.gesture().enabled, false);
    f.state.user = { _id: 'owner-b' }; f.render();
    assert.equal(f.gesture().enabled, true);
});

for (const isRTL of [false, true]) {
    test('Android RTL=' + isRTL + ': panel swipe closes only for a successful outward movement beyond the threshold', () => {
        const f = setup(undefined, undefined, { isRTL }); f.open();
        assert.equal(f.nodes().filter(node => node.type === 'GestureDetector').length, 2);
        const gesture = f.closeGesture();
        assert.notEqual(gesture, f.gesture(), 'Panel and edge gestures must be independent Pan instances');
        assert.equal(gesture.enabled, true);
        assert.equal(gesture.activeOffsetX, isRTL ? -24 : 24);
        assert.deepEqual([...gesture.failOffsetY], [-24, 24]);
        const outward = isRTL ? -1 : 1;
        for (const [label, event, success] of [
            ['short', { translationX: outward * 12, translationY: 0 }, true],
            ['boundary', { translationX: outward * 24, translationY: 0 }, true],
            ['inward', { translationX: outward * -70, translationY: 0 }, true],
            ['vertical', { translationX: 0, translationY: 100 }, true],
            ['failed vertical gesture', { translationX: outward * 70, translationY: 100 }, false],
            ['failed horizontal gesture', { translationX: outward * 70, translationY: 0 }, false],
        ]) {
            gesture.onEnd(event, success); f.render();
            assert.equal(f.modal().props.visible, true, label + ' must not close the modal');
            assert.ok(f.content());
        }
        gesture.onEnd({ translationX: outward * 70, translationY: 0 }, true); f.render();
        assert.equal(f.modal().props.visible, false);
        assert.equal(f.content(), undefined);
        assert.equal(f.closeGesture(), undefined, 'Closed modal leaves no panel gesture touch target');
        assert.equal(f.nodes().filter(node => node.type === 'GestureDetector').length, 1);
        f.finishClose();
        assert.deepEqual(f.state.routes, []);
        f.open();
        assert.equal(f.closeGesture().enabled, true);
    });

    test('Android RTL=' + isRTL + ': swipe-close cancels queued navigation and permits a fresh session', () => {
        const f = setup(undefined, undefined, { isRTL }); f.open();
        const gesture = f.closeGesture();
        f.content().props.onCloseThenRun(() => f.state.routes.push('/canceled-by-swipe'));
        gesture.onEnd({ translationX: isRTL ? -70 : 70, translationY: 0 }, true);
        f.render(); f.finishClose();
        assert.deepEqual(f.state.routes, []);
        f.open();
        f.content().props.onCloseThenRun(() => f.state.routes.push('/after-swipe'));
        f.render(); f.finishClose();
        assert.deepEqual(f.state.routes, ['/after-swipe']);
    });
}

test('menu backdrop uses the existing translated close_menu label', () => {
    const f = setup(); f.open();
    assert.equal(f.backdrop().props.accessibilityLabel, 'close_menu');
});

test('AppMenuProvider delegates both controls to the root and adds no modal or drawer engine', () => {
    const f = setup('components/app/AppMenuProvider.tsx', 'AppMenuProvider');
    f.value().openMenu(); f.value().closeMenu();
    assert.deepEqual(f.state.calls, ['delegate-open', 'delegate-close']);
    assert.ok(f.find('AppChildren'));
    assert.equal(f.find('Modal'), undefined);
});

test('tabs renders Slot only and never imports or mounts a second drawer', () => {
    const f = setup('app/(tabs)/_layout.tsx', 'default');
    assert.ok(f.find('Slot'));
    assert.equal(f.find('Modal'), undefined);
});

for (const isLoading of [false, true]) {
    test('navigation lock keeps Close X interactive, auth loading=' + isLoading, () => {
        const f = setup('components/app/AppMenuDrawer.tsx', 'AppMenuDrawerContent', {
            isLoading, props: { isNavigating: true },
        });
        const rows = () => f.nodes().filter(node => typeof node.type === 'function' && node.type.name === 'MenuRow');
        assert.ok(rows().length > 5);
        assert.ok(rows().every(row => row.props.disabled));
        assert.notEqual(f.find('SafeAreaView').props.pointerEvents, 'none');
        const close = f.nodes().find(node => node.type === 'Pressable' && descendants(node).some(child => child.type === 'X'));
        assert.notEqual(close.props.disabled, true);
        assert.equal(close.props.accessibilityLabel, 'close_menu');
        close.props.onPress();
        assert.deepEqual(f.state.calls, ['content-close']);
        rows()[0].props.onPress();
        assert.equal(f.state.queued.length, 0);
        if (!isLoading) {
            f.render({ isNavigating: false });
            assert.ok(rows().every(row => !row.props.disabled));
            rows()[0].props.onPress();
            assert.deepEqual(f.state.routes, []);
            f.state.queued[0]();
            assert.deepEqual(f.state.routes, ['/profile']);
        }
    });
}

test('menu destinations preserve current returnTo and support/logout remain deferred', async () => {
    const f = setup('components/app/AppMenuDrawer.tsx', 'AppMenuDrawerContent');
    const row = label => f.nodes().find(node => typeof node.type === 'function' && node.type.name === 'MenuRow' && node.props.label === label);
    row('partner_preference').props.onPress();
    assert.deepEqual(f.state.destinations, ['/partner-preference']);
    assert.deepEqual(f.state.routes, []);
    f.state.queued.shift()();
    assert.equal(f.state.routes[0].pathname, '/partner-preference');
    assert.equal(f.state.routes[0].params.returnTo, '/search');
    row('report_issue').props.onPress();
    assert.deepEqual(f.state.destinations, ['/partner-preference', undefined]);
    assert.deepEqual(f.state.calls, []);
    f.state.queued.shift()();
    assert.deepEqual(f.state.calls, ['support']);
    await row('logout').props.onPress();
    assert.deepEqual(f.state.destinations, ['/partner-preference', undefined, undefined]);
    assert.deepEqual(f.state.calls, ['support']);
    f.state.queued.shift()();
    assert.deepEqual(f.state.calls, ['support', 'logout']);
});

test('every internal menu row forwards its actual route as the diagnostic destination', () => {
    const f = setup('components/app/AppMenuDrawer.tsx', 'AppMenuDrawerContent');
    const rows = f.nodes().filter(node => typeof node.type === 'function' && node.type.name === 'MenuRow');
    for (const row of rows.filter(row => !['report_issue', 'logout'].includes(row.props.label))) {
        row.props.onPress();
        assert.equal(f.state.queued.length, 1, row.props.label + ' must remain deferred');
        assert.equal(f.state.routes.length, 0);
        const destination = f.state.destinations.pop();
        f.state.queued.shift()();
        const route = f.state.routes.pop();
        assert.equal(destination, typeof route === 'string' ? route : route.pathname, row.props.label);
        assert.equal(typeof destination, 'string');
        assert.ok(destination.startsWith('/'));
    }
});
