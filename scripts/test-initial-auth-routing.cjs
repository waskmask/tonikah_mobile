const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, dependencies) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
            jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(compiled, { module, exports: module.exports,
        require: (name) => {
            assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        } });
    return module.exports;
}
const authReturn = load('lib/authReturn.ts', {});
const state = {
    authenticated: false, restoring: false, hydrated: true, firstLaunch: true,
    step: 0, checked: false, returnTo: undefined,
};
let effects = [];
let destination;
const jsx = (type, props) => ({ type, props });
const { default: Index } = load('app/index.tsx', {
    react: { useEffect: (fn) => effects.push(fn), useState: () => [state.checked, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { router: { replace() {} }, useLocalSearchParams: () => ({ returnTo: state.returnTo }) },
    '@/store/authStore': { useAuthStore: () => ({
        isAuthenticated: state.authenticated, isRestoringSession: state.restoring,
        user: { profile: {} }, refreshUser: async () => {},
    }) },
    '@/hooks/useFirstLaunch': { useFirstLaunch: () => ({ isFirstLaunch: state.firstLaunch, isHydrated: state.hydrated }) },
    '@/store/profileSetupStore': { useProfileSetupStore: () => ({ getIncompleteStep: () => state.step, setGender() {} }) },
    '@/components/app/AppLoadingScreen': { AppLoadingScreen: 'Loading' },
    '@/lib/authReturn': authReturn,
    '@/lib/performanceDiagnostics': { markStartup: (_name, details) => { destination = details.destination; } },
});
function render(patch = {}) {
    Object.assign(state, patch);
    effects = [];
    destination = undefined;
    const result = Index();
    effects.forEach((effect) => effect());
    return result;
}
assert.equal(render().props.href, '/(onboarding)', 'logged-out first installation still sees intro');
assert.equal(destination, 'onboarding');
assert.equal(render({ authenticated: true }).props.href, '/search', 'login before completing intro must bypass slides');
assert.equal(destination, 'tabs');
assert.equal(render({ returnTo: '/messages' }).props.href, '/messages', 'preserve valid auth return route');
assert.equal(render({ returnTo: 'https://example.com' }).props.href, '/search', 'reject external return route');
assert.equal(render({ step: 3, checked: false }).type, 'Loading', 'incomplete cache still requires fresh user check');
assert.equal(render({ checked: true }).props.href, '/(profile-setup)/step3', 'intro bypass must not bypass profile setup');
assert.equal(destination, 'profile-setup');
assert.equal(render({ restoring: true }).type, 'Loading', 'wait for session restoration');
assert.equal(destination, undefined);
assert.equal(render({ restoring: false, hydrated: false }).type, 'Loading', 'wait for first-launch hydration');
assert.equal(destination, undefined);
assert.equal(render({ hydrated: true, authenticated: false, firstLaunch: false }).props.href, '/(auth)/login');
assert.equal(destination, 'login');
console.log('Initial routing checks passed (fresh install, login-before-intro, return paths, profile setup, hydration, returning login).');
