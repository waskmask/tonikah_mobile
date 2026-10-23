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
function load(file, requireMock) {
    const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const context = { exports: {}, require: requireMock };
    vm.runInNewContext(compiled, context, { filename: file });
    return context.exports;
}
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
const completeProfile = {
    profileName: 'Aisha', gender: 'female', mother_tongue: 'english', marital_status: 'single',
    height: 170, education: 'degree', sect: 'sunni', smoking: 'never',
    current_location: { city: 'Berlin' }, profile_manager: 'self', newProfile: false,
};

function setup({ profile = null, segment = 'step1', isRTL = false, ...overrides } = {}) {
    const hooks = [];
    const effects = [];
    let cursor = 0;
    let tree;
    const events = [];
    const state = {
        events, creates: [], toasts: [], refreshes: 0,
        user: { _id: 'owner', email: 'owner@example.invalid', profile },
        create: async payload => ({ success: true, profile: { ...payload, _id: 'saved-profile', newProfile: true } }),
        refresh: async () => {},
        ...overrides,
    };
    const mockReact = {
        ...React,
        useEffect(effect) { effects.push(effect); },
        useState(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
            return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = { current: initial };
            return hooks[index];
        },
        useMemo(factory, deps) {
            const index = cursor++;
            if (!hooks[index] || deps.some((value, i) => !Object.is(value, hooks[index].deps[i]))) hooks[index] = { deps, value: factory() };
            return hooks[index].value;
        },
    };
    const setupStore = load('store/profileSetupStore.ts', name => {
        assert.equal(name, 'zustand');
        return { create(initializer) {
            let data;
            const set = value => { data = { ...data, ...(typeof value === 'function' ? value(data) : value) }; };
            data = initializer(set, () => data);
            const store = selector => selector ? selector(data) : data;
            store.getState = () => data;
            return store;
        } };
    }).useProfileSetupStore;
    const originalSetGender = setupStore.getState().setGender;
    const originalSetProfileData = setupStore.getState().setProfileData;
    setupStore.getState().setGender = value => { events.push('setGender'); originalSetGender(value); };
    setupStore.getState().setProfileData = value => { events.push('setProfileData'); originalSetProfileData(value); };
    const auth = {
        get user() { return state.user; },
        setUser(user) { events.push('setUser'); state.user = user; },
        async refreshUser() { state.refreshes++; events.push('refreshUser'); return state.refresh(); },
    };
    const authStore = selector => selector(auth);
    authStore.getState = () => auth;
    function Stack() {}
    Stack.Screen = 'StackScreen';
    const router = { replace(href) { events.push(['replace', href, state.user?.profile]); } };
    const translate = (key, options) => options?.defaultValue || key;
    const requireMock = name => {
        if (name === 'react') return mockReact;
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react-native') return { View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' }, StyleSheet: { create: value => value, absoluteFill: {} } };
        if (name === 'expo-router') return { router, Redirect: 'Redirect', Stack, useSegments: () => ['(profile-setup)', segment] };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: translate }) };
        if (name === 'react-native-keyboard-controller') return { KeyboardAwareScrollView: 'KeyboardAwareScrollView' };
        if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
        if (name === 'expo-linear-gradient') return { LinearGradient: 'LinearGradient' };
        if (name === 'phosphor-react-native') return { CaretLeft: 'CaretLeft', CaretRight: 'CaretRight' };
        if (name === '@/hooks/useTheme') return { useTheme: () => ({ isDark: false }) };
        if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL, currentLanguage: 'en' }) };
        if (name === '@/hooks/useResponsive') return { scale: value => value };
        if (name === '@/hooks/useColors') return { useColors: () => ({ brand: { bg: { border: 'border' }, gradient: { start: 'pink', end: 'red' } }, chrome: { header: { icon: 'icon' } } }) };
        if (name === '@/hooks/useToast') return { toast: { show: (...args) => state.toasts.push(args) } };
        if (name === '@/constants/uiTokens') return { ProfileSetupTokens: { scrollContent: {} }, space: () => 4 };
        if (name === '@/constants/profileOptions') return { COUNTRY_OPTIONS: ['germany'], NATIONALITY_OPTIONS: ['german'] };
        if (name === '@/lib/profileOptionLabels') return { formatProfileOptionLabel: value => value };
        if (name === '@/lib/profileDisplay') return { t: (_key, fallback) => fallback, apiMessage: key => key };
        if (name === '@/store/authStore') return { useAuthStore: authStore };
        if (name === '@/store/profileSetupStore') return { useProfileSetupStore: setupStore };
        if (name === '@/lib/profileService') return { profileService: { createProfile: async payload => { state.creates.push(payload); return state.create(payload); } } };
        if (name === '@/components/ui/FormField') return { SelectField: 'SelectField', FieldLabel: 'FieldLabel', ErrorText: 'ErrorText' };
        if (name === '@/components/ui/icons/PhosphorCompat') return Object.fromEntries(['VenusAndMars', 'CalendarDays', 'Flag', 'Footprints', 'User'].map(icon => [icon, icon]));
        if (name.startsWith('@/components/ui/')) { const component = name.split('/').at(-1); return { [component]: component }; }
        throw new Error(`Unexpected import: ${name}`);
    };
    const Step1 = load('app/(profile-setup)/step1.tsx', requireMock).default;
    const render = () => { cursor = 0; tree = Step1(); return tree; };
    const find = type => descendants(tree).find(node => node.type === type);
    render();
    return {
        state, setupStore, events, render, find,
        navigation: () => events.filter(event => Array.isArray(event) && event[0] === 'replace'),
        layout: () => {
            const result = load('app/(profile-setup)/_layout.tsx', requireMock).default();
            while (effects.length) effects.shift()();
            return result;
        },
        progress: step => load('components/ui/ProgressBar.tsx', requireMock).ProgressBar({ currentStep: step }),
        fill() {
            find('Input').props.onChangeText('Aisha');
            descendants(tree).filter(node => node.type === 'SingleSelectSheet')[0].props.onSelect('female');
            find('DateWheelSheet').props.onConfirm(new Date(1995, 4, 12));
            find('MultiSelectSheet').props.onConfirm(['german']);
            descendants(tree).filter(node => node.type === 'SingleSelectSheet')[1].props.onSelect('germany');
            render();
            find('GradientButton').props.onPress(); render();
            assert.equal(find('ConfirmSheet').props.visible, true);
        },
        confirm: () => find('ConfirmSheet').props.onConfirm(),
    };
}

for (const isRTL of [false, true]) {
    for (const step of [1, 2, 3, 10]) {
        test(`ProgressBar step ${step}, RTL=${isRTL}: cannot return to immutable step1`, () => {
            const f = setup({ isRTL });
            const nodes = descendants(f.progress(step));
            const button = nodes.find(node => node.type === 'Pressable');
            if (step <= 2) assert.equal(button, undefined);
            else {
                assert.ok(button);
                assert.ok(nodes.some(node => node.type === (isRTL ? 'CaretRight' : 'CaretLeft')));
                button.props.onPress();
                assert.equal(f.navigation()[0][1], `/(profile-setup)/step${step - 1}`);
            }
        });
    }
}

for (const [profile, expected] of [
    [{}, '/(profile-setup)/step2'],
    [{ profileName: 'Aisha' }, '/(profile-setup)/step2'],
    [{ ...completeProfile, education: '' }, '/(profile-setup)/step5'],
    [{ ...completeProfile, newProfile: true }, '/(profile-setup)/step10'],
    [completeProfile, '/search'],
]) {
    test(`layout redirects existing-profile step1 to ${expected}`, () => {
        const f = setup({ profile });
        const tree = f.layout();
        assert.equal(tree.type, 'Redirect');
        assert.equal(tree.props.href, expected);
    });
}

test('layout leaves first-time step1 accessible and disables only step2 back gesture', () => {
    const f = setup();
    const nodes = descendants(f.layout());
    assert.equal(nodes.some(node => node.type === 'Redirect'), false);
    assert.equal(nodes.find(node => node.type === 'StackScreen' && node.props.name === 'step2').props.options.gestureEnabled, false);
    assert.equal(nodes.find(node => node.type === 'StackScreen' && node.props.name === 'step3').props.options?.gestureEnabled, undefined);
});

test('layout does not redirect an existing profile already on a later step', () => {
    const f = setup({ profile: { profileName: 'Aisha' }, segment: 'step2' });
    assert.equal(descendants(f.layout()).some(node => node.type === 'Redirect'), false);
});

for (const segment of ['step1', 'step2']) {
    test(`layout seeds auth profile and gender into setup state on ${segment}`, () => {
        const profile = { ...completeProfile, education: '', gender: 'female', _id: 'existing-profile' };
        const f = setup({ profile, segment });
        assert.equal(f.setupStore.getState().gender, '');
        f.layout();
        assert.equal(f.setupStore.getState().gender, 'female');
        assert.equal(f.setupStore.getState().profileData._id, 'existing-profile');
        assert.equal(f.setupStore.getState().profileData.profileName, profile.profileName);
        assert.equal(f.state.creates.length, 0);
    });
}

test('layout clears stale setup gender when the resumed profile has no gender', () => {
    const f = setup({ profile: { profileName: 'Existing' } });
    f.setupStore.getState().setGender('male');
    f.layout();
    assert.equal(f.setupStore.getState().gender, '');
    assert.equal(f.setupStore.getState().profileData.profileName, 'Existing');
});

test('Continue with a cached profile resumes without validation or creation', () => {
    const f = setup({ profile: { ...completeProfile, education: '' } });
    f.find('GradientButton').props.onPress(); f.render();
    assert.equal(f.state.creates.length, 0);
    assert.equal(f.find('ConfirmSheet').props.visible, false);
    assert.equal(f.navigation()[0][1], '/(profile-setup)/step5');
    assert.equal(f.setupStore.getState().gender, 'female');
    assert.equal(f.setupStore.getState().profileData.profileName, 'Aisha');
    const navigateIndex = f.events.indexOf(f.navigation()[0]);
    assert.ok(f.events.indexOf('setGender') < navigateIndex);
    assert.ok(f.events.indexOf('setProfileData') < navigateIndex);
});

test('confirmation rechecks a profile cached after the form was opened', async () => {
    const f = setup(); f.fill();
    f.state.user = { ...f.state.user, profile: completeProfile };
    await f.confirm(); f.render();
    assert.equal(f.state.creates.length, 0);
    assert.equal(f.navigation()[0][1], '/search');
    assert.equal(f.find('ConfirmSheet').props.visible, false);
    assert.equal(f.setupStore.getState().gender, completeProfile.gender);
    assert.equal(f.setupStore.getState().profileData.profileName, completeProfile.profileName);
});

test('create is single-flight and caches the server profile before navigating', async () => {
    const create = deferred();
    const saved = { ...completeProfile, _id: 'server-profile', newProfile: true };
    const f = setup({ create: () => create.promise }); f.fill();
    const first = f.confirm();
    await f.confirm();
    assert.equal(f.state.creates.length, 1);
    f.render();
    assert.equal(f.find('GradientButton').props.disabled, true);
    create.resolve({ success: true, profile: saved }); await first; f.render();
    assert.equal(f.state.user.profile, saved);
    assert.equal(f.setupStore.getState().profileData._id, saved._id);
    assert.equal(f.navigation()[0][1], '/(profile-setup)/step2');
    assert.equal(f.navigation()[0][2], saved);
    assert.ok(f.events.indexOf('setUser') < f.events.indexOf('refreshUser'));
    assert.equal(f.state.refreshes, 1);
    f.find('GradientButton').props.onPress();
    assert.equal(f.state.creates.length, 1);
    assert.equal(f.navigation().at(-1)[1], '/(profile-setup)/step10');
});

test('a successful legacy response without profile caches submitted basics before navigating', async () => {
    const f = setup({ create: async () => ({ success: true }) }); f.fill();
    await f.confirm();
    assert.equal(f.state.user.profile.profileName, 'Aisha');
    assert.equal(f.state.user.profile.dob, '1995-05-12');
    assert.equal(f.navigation()[0][2].profileName, 'Aisha');
    assert.equal(f.navigation()[0][1], '/(profile-setup)/step2');
});

for (const [profile, expected] of [
    [{}, '/(profile-setup)/step2'],
    [{ ...completeProfile, smoking: '' }, '/(profile-setup)/step7'],
    [completeProfile, '/search'],
]) {
    test(`profile_already_exists refreshes and resumes at ${expected} without recreating`, async () => {
        const refresh = deferred();
        const f = setup({ create: async () => ({ success: false, message: 'profile_already_exists' }), refresh: () => refresh.promise });
        f.fill(); const pending = f.confirm();
        await new Promise(setImmediate);
        assert.equal(f.state.refreshes, 1);
        assert.equal(f.navigation().length, 0);
        f.state.user = { ...f.state.user, profile }; refresh.resolve(); await pending;
        assert.equal(f.navigation()[0][1], expected);
        assert.equal(f.state.creates.length, 1);
        assert.deepEqual(f.state.toasts, []);
        assert.equal(f.setupStore.getState().gender, profile.gender || '');
        assert.equal(f.setupStore.getState().profileData.profileName, profile.profileName);
    });
}

for (const refreshFailure of [true, false]) {
    test(`conflict ${refreshFailure ? 'refresh failure' : 'refresh without profile'} reports an error without advancing or seeding guessed basics`, async () => {
        const f = setup({
            create: async () => ({ success: false, message: 'profile_already_exists' }),
            refresh: async () => { if (refreshFailure) throw Error('offline'); },
        });
        f.fill(); await f.confirm(); f.render();
        assert.equal(f.navigation().length, 0);
        assert.equal(f.state.creates.length, 1);
        assert.equal(f.state.refreshes, 1);
        assert.deepEqual(f.state.toasts, [['server_error_default', 'error']]);
        assert.equal(Object.keys(f.setupStore.getState().profileData).length, 0);
        assert.equal(f.setupStore.getState().gender, '');
        assert.equal(f.find('GradientButton').props.disabled, false);
    });
}

test('confirmation after logout does not create a profile or navigate', async () => {
    const f = setup(); f.fill();
    f.state.user = null;
    await f.confirm();
    assert.equal(f.state.creates.length, 0);
    assert.equal(f.navigation().length, 0);
});

test('late successful creation cannot update or navigate a different account', async () => {
    const create = deferred();
    const f = setup({ create: () => create.promise }); f.fill();
    const pending = f.confirm();
    const nextUser = { _id: 'another-owner', profile: null };
    f.state.user = nextUser;
    create.resolve({ success: true, profile: completeProfile }); await pending;
    assert.equal(f.state.user, nextUser);
    assert.equal(f.navigation().length, 0);
    assert.equal(f.state.refreshes, 0);
    assert.equal(f.setupStore.getState().gender, '');
});

test('account change during conflict refresh prevents stale resume navigation', async () => {
    const refresh = deferred();
    const f = setup({ create: async () => ({ success: false, message: 'profile_already_exists' }), refresh: () => refresh.promise });
    f.fill(); const pending = f.confirm(); await new Promise(setImmediate);
    f.state.user = { _id: 'another-owner', profile: completeProfile };
    refresh.resolve(); await pending;
    assert.equal(f.navigation().length, 0);
    assert.equal(f.state.user._id, 'another-owner');
});

test('failed create reports the error and releases its duplicate-submit guard for retry', async () => {
    const f = setup({ create: async () => ({ success: false, message: 'server_error_default' }) });
    f.fill(); await f.confirm(); f.render();
    assert.equal(f.state.toasts.length, 1);
    assert.equal(f.navigation().length, 0);
    assert.equal(f.find('GradientButton').props.disabled, false);
    f.state.create = async payload => ({ success: true, profile: payload });
    f.find('GradientButton').props.onPress(); f.render(); await f.confirm();
    assert.equal(f.state.creates.length, 2);
    assert.equal(f.navigation()[0][1], '/(profile-setup)/step2');
});
