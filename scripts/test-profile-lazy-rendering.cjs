const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

function setup({ focused = false, cached = true, meImpl, galleryImpl, partnerImpl } = {}) {
    const calls = { me: 0, gallery: 0, partner: 0, invalidations: [], queries: [] };
    const slots = [];
    const idle = new Map();
    const cache = new Map();
    const pendingEffects = [];
    let cursor = 0;
    let dirty = true;
    let tree;
    let nextIdle = 1;
    let authUser = cached ? { id: 'profile-user', profile: { profileName: 'Cached profile' } } : null;
    const loadedUser = { id: 'profile-user', profile: { profileName: 'Loaded profile' } };
    const gallery = { success: true, gallery: [], privacy: 'public' };
    if (cached) cache.set('gallery', gallery);
    const keys = { gallery: { me: ['gallery'] }, profile: { mySummary: ['summary'], partnerPreference: ['partner'] } };
    const keyOf = key => JSON.stringify(key);
    const queryClient = {
        getQueryData: key => cache.get(key[0]),
        setQueryData: (key, data) => cache.set(key[0], data),
        invalidateQueries: async ({ queryKey }) => { calls.invalidations.push(keyOf(queryKey)); },
        fetchQuery: async ({ queryKey, queryFn }) => {
            const value = await queryFn(); cache.set(queryKey[0], value); return value;
        },
    };
    const setUser = user => { authUser = user; };
    const patchUserProfile = patch => { authUser = { ...authUser, profile: { ...authUser?.profile, ...patch } }; };
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
            return [slots[index].value, value => {
                const next = typeof value === 'function' ? value(slots[index].value) : value;
                if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
            }];
        },
        useMemo(factory, deps) {
            const index = cursor++;
            if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { deps, value: factory() };
            return slots[index].value;
        },
        useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(slots[index]?.deps, deps)) {
                const previous = slots[index];
                slots[index] = { deps, cleanup: previous?.cleanup };
                pendingEffects.push(() => {
                    previous?.cleanup?.(); slots[index].cleanup = effect();
                });
            }
        },
    };
    const useFocusEffect = callback => {
        const index = cursor++;
        const before = slots[index];
        if (!before || before.focused !== focused || before.callback !== callback) {
            slots[index] = { focused, callback };
            pendingEffects.push(() => {
                before?.cleanup?.();
                if (focused) slots[index].cleanup = callback();
            });
        }
    };
    function EditProfileScreen() { throw new Error('Native editor is intentionally not executed in this VM harness'); }
    function UserProfileView() { throw new Error('Native preview is intentionally not executed in this VM harness'); }
    const profileService = {
        async fetchMe() { calls.me++; return meImpl ? meImpl(calls.me) : { success: true, user: loadedUser }; },
        async fetchPartnerPreference() {
            calls.partner++;
            return partnerImpl ? partnerImpl(calls.partner) : { success: true, partner_preference: { ageMin: 25 } };
        },
    };
    const galleryService = { async fetchMe() { calls.gallery++; return galleryImpl ? galleryImpl(calls.gallery) : gallery; } };
    const resolve = name => {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react-native') return {
            ActivityIndicator: 'ActivityIndicator', View: 'View', Pressable: 'Pressable',
            Platform: { OS: 'android' }, StyleSheet: { create: styles => styles },
            useWindowDimensions: () => ({ width: 390, height: 844 }),
        };
        if (name === 'expo-router') return { useIsFocused: () => focused, useFocusEffect };
        if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 24 }) };
        if (name === 'react-native-gesture-handler') return {
            GestureDetector: 'GestureDetector', Gesture: { Pan: () => {
                const gesture = { handlers: {} };
                for (const method of ['activeOffsetX', 'failOffsetY', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
                    gesture[method] = value => { gesture.handlers[method] = value; return gesture; };
                }
                return gesture;
            } },
        };
        if (name === 'react-native-reanimated') return {
            __esModule: true, default: { View: 'AnimatedView' }, Easing: { out: value => value, cubic: 'cubic' },
            runOnJS: callback => callback, withTiming: value => value,
            useAnimatedStyle: factory => factory(), useSharedValue: value => hooks.useRef({ value }).current,
        };
        if (name === '@tanstack/react-query') return {
            useQueryClient: () => queryClient,
            useQuery: options => { calls.queries.push(options); return { data: cache.get(options.queryKey[0]) }; },
        };
        if (name === './edit-profile') return { __esModule: true, default: EditProfileScreen };
        if (name === '@/components/profile/UserProfileView') return { UserProfileView };
        if (name === '@/components/ui/Text') return { Text: 'Text' };
        if (name === '@/components/dev/DevRenderProfiler') return { DevRenderProfiler: 'DevRenderProfiler' };
        if (name === '@/hooks/useColors') return { useColors: () => ({ brand: { bg: { surface: 'surface' } }, chrome: { primary: 'primary' } }) };
        if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL: false, t: key => key }) };
        if (name === '@/hooks/useResponsive') return { scale: value => value };
        if (name === '@/lib/galleryService') return { galleryService };
        if (name === '@/lib/profileService') return { profileService };
        if (name === '@/lib/queryKeys') return { queryKeys: keys };
        if (name === '@/lib/idleWork') return { scheduleIdleWork: callback => {
            const id = nextIdle++; idle.set(id, callback); return () => idle.delete(id);
        } };
        if (name === '@/store/authStore') return { useAuthStore: selector => selector({ user: authUser, setUser, patchUserProfile }) };
        throw new Error(`Unexpected ProfileScreen import: ${name}`);
    };
    const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/(main)/(profile)/profile.tsx'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const context = { exports: {}, require: resolve };
    vm.runInNewContext(compiled, context, { filename: 'profile.tsx' });
    const Component = context.exports.default;
    const render = () => {
        let passes = 0;
        do {
            assert.ok(++passes < 30, 'effects should converge');
            dirty = false; cursor = 0; tree = Component();
            pendingEffects.splice(0).forEach(effect => effect());
        } while (dirty);
    };
    const findMemo = original => descendants(tree).find(node => node.type?.type === original);
    render();
    return {
        calls, idle, queryClient,
        render,
        editor: () => findMemo(EditProfileScreen),
        preview: () => findMemo(UserProfileView),
        nodes: () => descendants(tree),
        focus() { focused = true; render(); },
        blur() { focused = false; render(); },
        mode(value) {
            const bar = descendants(tree).find(node => typeof node.type === 'function' && node.type.name === 'ProfileModeBar');
            assert.ok(bar); bar.props.onChange(value); render();
        },
        gesture() { return descendants(tree).find(node => node.type === 'GestureDetector').props.gesture.handlers; },
        async settle() { await new Promise(setImmediate); render(); },
        async flushIdle() {
            const batch = [...idle.values()]; idle.clear(); batch.forEach(callback => callback());
            await new Promise(setImmediate); render();
        },
        unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    };
}

test('off-focus prefetch mounts neither editor nor preview and does not fetch profile/gallery', async () => {
    for (const cached of [true, false]) {
        const f = setup({ cached });
        f.render(); await f.flushIdle(); await f.settle();
        assert.equal(f.editor(), undefined); assert.equal(f.preview(), undefined);
        assert.equal(f.calls.me, 0); assert.equal(f.calls.gallery, 0); assert.equal(f.calls.partner, 0);
        assert.equal(f.calls.invalidations.length, 0);
        assert.ok(f.calls.queries.every(query => query.enabled === false));
        f.unmount();
    }
});

test('first focus mounts memoized editor immediately and preserves its React identity/key across blur and preview', async () => {
    const f = setup(); f.focus();
    const first = f.editor();
    assert.ok(first); assert.equal(first.props.active, true); assert.equal(first.props.embedded, true);
    assert.equal(first.key, '0'); assert.equal(first.type.$$typeof, React.memo(() => null).$$typeof);
    assert.equal(f.calls.me, 0, 'cached network work stays deferred');
    f.blur();
    assert.equal(f.editor().type, first.type); assert.equal(f.editor().key, first.key);
    assert.equal(f.editor().props.active, false);
    f.focus(); f.mode('preview');
    assert.equal(f.editor().type, first.type); assert.equal(f.editor().key, first.key);
    assert.equal(f.editor().props.active, false);
    assert.ok(f.preview());
    f.mode('edit');
    assert.equal(f.editor().type, first.type); assert.equal(f.editor().key, first.key);
    assert.equal(f.editor().props.active, true);
    await f.flushIdle();
    assert.equal(f.editor().key, first.key, 'background profile load must not reset dirty editor drafts via a new key');
    f.unmount();
});

test('flushing all initial idle work never auto-mounts preview', async () => {
    const f = setup({ focused: true });
    await f.flushIdle(); await f.flushIdle(); f.render();
    assert.ok(f.editor()); assert.equal(f.preview(), undefined); assert.equal(f.calls.partner, 0);
    f.unmount();
});

test('explicit Preview tab intent mounts preview, retained after returning to Edit', () => {
    const f = setup({ focused: true });
    assert.equal(f.preview(), undefined);
    f.mode('preview'); const first = f.preview();
    assert.ok(first); assert.equal(first.props.publicPreview, true);
    f.mode('edit');
    assert.equal(f.preview().type, first.type); assert.equal(f.preview().key, first.key);
    assert.equal(f.editor().props.active, true);
    f.unmount();
});

test('pager intent mounts preview on gesture start and selects it on projected end', () => {
    const f = setup({ focused: true });
    const gesture = f.gesture();
    gesture.onStart(); f.render();
    assert.ok(f.preview()); assert.equal(f.editor().props.active, true);
    gesture.onUpdate({ translationX: -250 }); gesture.onEnd({ velocityX: -100 }); f.render();
    assert.equal(f.editor().props.active, false);
    gesture.onFinalize();
    f.unmount();
});

test('cached initial fetch is canceled on blur and can be scheduled again on refocus', async () => {
    const f = setup(); f.focus();
    assert.equal(f.idle.size, 1); assert.equal(f.calls.me, 0);
    f.blur(); assert.equal(f.idle.size, 0);
    await f.flushIdle(); assert.equal(f.calls.me, 0); assert.equal(f.calls.gallery, 0);
    f.focus(); assert.equal(f.idle.size, 1);
    await f.flushIdle();
    assert.equal(f.calls.me, 1); assert.equal(f.calls.gallery, 1);
    f.render(); f.render(); await f.flushIdle();
    assert.equal(f.calls.me, 1); assert.equal(f.calls.gallery, 1);
    f.blur(); f.focus(); await f.flushIdle();
    assert.equal(f.calls.me, 1, 'a successful initial load is not restarted on every visit');
    f.unmount();
});

test('uncached profile starts immediately only on focus and single-flights unrelated renders', async () => {
    let resolveMe;
    const pending = new Promise(resolve => { resolveMe = resolve; });
    const f = setup({ cached: false, meImpl: () => pending });
    assert.equal(f.calls.me, 0);
    f.focus(); assert.equal(f.calls.me, 1); assert.equal(f.calls.gallery, 1); assert.equal(f.idle.size, 0);
    f.render(); f.render(); f.blur(); f.focus();
    assert.equal(f.calls.me, 1);
    resolveMe({ success: true, user: { id: 'user', profile: { profileName: 'Resolved' } } });
    await f.settle();
    assert.ok(f.editor()); assert.equal(f.editor().props.active, true);
    f.unmount();
});

test('uncached thrown load error clears loading and allows a focus retry without an unhandled rejection', async () => {
    const f = setup({ cached: false, meImpl: async attempt => {
        if (attempt === 1) throw new Error('offline');
        return { success: true, user: { id: 'user', profile: {} } };
    } });
    f.focus(); await f.settle();
    assert.ok(!f.nodes().some(node => node.type === 'ActivityIndicator'));
    assert.ok(f.nodes().some(node => node.type === 'Text' && node.props.children === 'offline'));
    f.render(); assert.equal(f.calls.me, 1);
    f.blur(); f.focus(); await f.settle();
    assert.equal(f.calls.me, 2); assert.ok(f.editor());
    f.unmount();
});

test('cached thrown load failure releases single-flight and retries deferred work on next focus', async () => {
    const f = setup({ meImpl: async attempt => {
        if (attempt === 1) throw new Error('offline');
        return { success: true, user: { id: 'user', profile: {} } };
    } });
    f.focus(); await f.flushIdle();
    assert.ok(f.editor());
    f.blur(); f.focus(); assert.equal(f.calls.me, 1);
    await f.flushIdle(); assert.equal(f.calls.me, 2);
    f.unmount();
});

for (const firstResponse of [
    { success: false, message: 'profile_temporarily_unavailable' },
    { success: true },
]) {
    test(`unsuccessful profile response ${JSON.stringify(firstResponse)} permits blur/refocus retry`, async () => {
        const f = setup({ cached: false, meImpl: async attempt => attempt === 1 ? firstResponse
            : { success: true, user: { id: 'retry-user', profile: { profileName: 'Recovered' } } } });
        f.focus(); await f.settle();
        assert.equal(f.calls.me, 1);
        assert.equal(f.editor(), undefined);
        assert.ok(!f.nodes().some(node => node.type === 'ActivityIndicator'));
        assert.ok(f.nodes().some(node => node.type === 'Text'
            && node.props.children === (firstResponse.message || 'profile_unavailable')));
        f.render(); await f.flushIdle();
        assert.equal(f.calls.me, 1, 'handled failure must not cause a render-driven retry loop');
        f.blur(); f.focus(); await f.settle();
        assert.equal(f.calls.me, 2);
        assert.equal(f.calls.gallery, 2);
        assert.ok(f.editor());
        assert.equal(f.editor().props.active, true);
        f.blur(); f.focus(); await f.flushIdle();
        assert.equal(f.calls.me, 2, 'successful retry restores the initial-load guard');
        f.unmount();
    });
}

test('partner preferences fetch only in focused Preview and pending work cancels on blur', async () => {
    const f = setup({ focused: true });
    await f.flushIdle(); assert.equal(f.calls.partner, 0);
    f.mode('preview'); assert.equal(f.idle.size, 1);
    f.blur(); await f.flushIdle(); assert.equal(f.calls.partner, 0);
    f.focus(); await f.flushIdle(); assert.equal(f.calls.partner, 0, 'focus restores Edit rather than warming Preview');
    f.mode('preview'); await f.flushIdle();
    assert.equal(f.calls.partner, 1);
    assert.equal(f.preview().props.initialProfile.partner_preference.ageMin, 25);
    f.mode('edit'); f.mode('preview'); await f.flushIdle();
    assert.equal(f.calls.partner, 1, 'cached preferences do not refetch');
    f.unmount();
});
