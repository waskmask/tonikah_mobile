const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

// Persistence hydration is deliberately idle; every assertion exercises the real setLanguage action.
function setup(initial = 'en', { storageGate, writeLanguage, dev = false } = {}) {
    const events = [];
    const timers = [];
    let state;
    const storage = {
        async getItem() { return null; },
        async setItem(key, value) {
            events.push(['storage', key, value]);
            if (key === 'user-language' && storageGate) await storageGate.promise;
            if (key === 'user-language' && writeLanguage) await writeLanguage(value);
        },
    };
    const i18n = { language: initial, async changeLanguage(code) {
        events.push(['i18n', code]);
        i18n.language = code;
    } };
    const store = Object.assign(() => state, {
        getState: () => state,
        setState: patch => { state = { ...state, ...patch }; },
    });
    const resolve = name => {
        if (name === 'zustand') return { create: () => initializer => {
            state = initializer(store.setState, store.getState, store);
            return store;
        } };
        if (name === 'zustand/middleware') return { persist: initializer => initializer, createJSONStorage: factory => factory() };
        if (name === '@react-native-async-storage/async-storage') return storage;
        if (name === 'i18next') return i18n;
        if (name === '@/lib/i18n') return { i18nReady: Promise.resolve() };
        if (name === '@/lib/performanceDiagnostics') return { markStartup() {} };
        if (name === 'react-native') return {
            Image: { resolveAssetSource: () => ({ uri: 'heart.png' }) },
            DevSettings: { reload: () => events.push(['dev-reload']) },
            I18nManager: {
                isRTL: initial === 'ar',
                allowRTL: value => events.push(['allowRTL', value]),
                forceRTL: value => events.push(['forceRTL', value]),
                swapLeftAndRightInRTL: value => events.push(['swapRTL', value]),
            },
        };
        if (name === 'expo-updates') return {
            async reloadAsync() { events.push(['reload']); },
            async showReloadScreen() { events.push(['reload-screen']); },
        };
        if (name.endsWith('.png')) return name;
        throw new Error(`Unexpected language store import: ${name}`);
    };
    const source = fs.readFileSync(path.join(__dirname, '../store/languageStore.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const context = { exports: {}, require: resolve, __DEV__: dev, console,
        setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; } };
    vm.runInNewContext(compiled, context, { filename: 'store/languageStore.ts' });
    return { store: context.exports.useLanguageStore, events, timers, i18n,
        routeKey: context.exports.POST_LANGUAGE_ROUTE_KEY,
        async flushReload() {
            for (const timer of timers.splice(0)) { assert.equal(timer.delay, 120); await timer.callback(); }
        },
    };
}

for (const [from, to] of [['en', 'de'], ['de', 'en']]) {
    test(`${from}->${to}: selection updates while user-language storage is still blocked, without reload`, async () => {
        const gate = deferred();
        const f = setup(from, { storageGate: gate });
        let completed = false;
        const change = f.store.getState().setLanguage(to, '/language?returnTo=%2Fsearch').then(() => { completed = true; });
        await new Promise(setImmediate);
        assert.equal(completed, false);
        assert.equal(f.store.getState().currentLanguage, to);
        assert.equal(f.store.getState().isRTL, false);
        assert.equal(f.store.getState().isReady, true);
        assert.deepEqual(f.events, [['i18n', to], ['storage', 'user-language', to]]);
        assert.equal(f.timers.length, 0);
        gate.resolve();
        await change;
        assert.equal(completed, true);
        assert.equal(f.timers.length, 0);
    });
}

test('repeated EN/DE changes remain in place and retain the latest selection', async () => {
    const f = setup();
    for (const code of ['de', 'en', 'de', 'en']) {
        await f.store.getState().setLanguage(code, '/language?returnTo=%2Fsearch');
        assert.equal(f.store.getState().currentLanguage, code);
        assert.equal(f.store.getState().isReady, true);
    }
    assert.equal(f.timers.length, 0);
    assert.ok(f.events.every(event => event[0] === 'i18n' || event[0] === 'storage' && event[1] === 'user-language'));
});

test('failed persistence rolls selection and i18n back, rejects to the caller, and allows the same language to be retried', async () => {
    const failure = new Error('storage unavailable');
    let writes = 0;
    const f = setup('en', { writeLanguage: async () => {
        if (++writes === 1) throw failure;
    } });
    await assert.rejects(f.store.getState().setLanguage('de'), error => error === failure);
    assert.equal(f.store.getState().currentLanguage, 'en');
    assert.equal(f.store.getState().isRTL, false);
    assert.equal(f.store.getState().isReady, true);
    assert.equal(f.i18n.language, 'en');
    assert.deepEqual(f.events, [['i18n', 'de'], ['storage', 'user-language', 'de'], ['i18n', 'en']]);
    await f.store.getState().setLanguage('de');
    assert.equal(writes, 2, 'retry must write again instead of returning as already selected');
    assert.equal(f.store.getState().currentLanguage, 'de');
    assert.equal(f.store.getState().isReady, true);
    assert.equal(f.i18n.language, 'de');
    assert.deepEqual(f.events.slice(-2), [['i18n', 'de'], ['storage', 'user-language', 'de']]);
    assert.equal(f.timers.length, 0);
});

test('an older failed write rejects without rolling back a different newer selection or its i18n', async () => {
    const olderWrite = deferred();
    const failure = new Error('older write failed');
    const f = setup('en', { writeLanguage: value => value === 'de' ? olderWrite.promise : Promise.resolve() });
    const oldChange = f.store.getState().setLanguage('de');
    const rejected = assert.rejects(oldChange, error => error === failure);
    await new Promise(setImmediate);
    assert.equal(f.store.getState().currentLanguage, 'de');
    await f.store.getState().setLanguage('fr');
    assert.equal(f.store.getState().currentLanguage, 'fr');
    assert.equal(f.i18n.language, 'fr');
    const eventsBeforeFailure = f.events.slice();
    olderWrite.reject(failure);
    await rejected;
    assert.equal(f.store.getState().currentLanguage, 'fr');
    assert.equal(f.store.getState().isRTL, false);
    assert.equal(f.store.getState().isReady, true);
    assert.equal(f.i18n.language, 'fr');
    assert.deepEqual(f.events, eventsBeforeFailure, 'stale failure must not change i18n or trigger native effects');
    assert.equal(f.timers.length, 0);
});

for (const [from, to] of [['en', 'ar'], ['de', 'ar'], ['ar', 'en'], ['ar', 'de']]) {
    test(`${from}->${to}: direction change persists language and origin before changing native flags and reloading`, async () => {
        const gate = deferred();
        const f = setup(from, { storageGate: gate });
        const route = '/language?returnTo=%2Fsearch';
        const change = f.store.getState().setLanguage(to, route);
        await new Promise(setImmediate);
        assert.equal(f.store.getState().currentLanguage, from);
        assert.equal(f.timers.length, 0);
        assert.deepEqual(f.events, [['i18n', to], ['storage', 'user-language', to]]);
        gate.resolve();
        await change;
        const rtl = to === 'ar';
        assert.equal(f.store.getState().currentLanguage, to);
        assert.equal(f.store.getState().isRTL, rtl);
        assert.equal(f.store.getState().isReady, false);
        assert.deepEqual(f.events, [
            ['i18n', to], ['storage', 'user-language', to], ['storage', f.routeKey, route],
            ['allowRTL', rtl], ['forceRTL', rtl],
        ]);
        assert.equal(f.timers.length, 1);
        await f.flushReload();
        assert.deepEqual(f.events.at(-1), ['reload']);
    });
}

test('development RTL changes preserve the reload-screen then native reload sequence', async () => {
    const f = setup('en', { dev: true });
    await f.store.getState().setLanguage('ar');
    await f.flushReload();
    assert.deepEqual(f.events.slice(-2), [['reload-screen'], ['dev-reload']]);
});

test('selecting the current language does not persist, change i18n, or reload', async () => {
    for (const code of ['en', 'de', 'ar']) {
        const f = setup(code);
        await f.store.getState().setLanguage(code, '/language');
        assert.deepEqual(f.events, []);
        assert.equal(f.timers.length, 0);
    }
});
