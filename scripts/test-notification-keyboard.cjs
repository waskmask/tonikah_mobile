const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const context = { exports: {}, console, require(name) {
        if (name in mocks) return mocks[name];
        throw Error(`Unexpected module ${name}`);
    } };
    vm.runInNewContext(code, context, { filename: file });
    return context.exports;
}

function pushHarness(state = 'active') {
    const actions = [];
    const stateListeners = new Set();
    const responseListeners = new Set();
    let last = null;
    const appState = { currentState: state, addEventListener(_name, cb) { stateListeners.add(cb); return { remove: () => stateListeners.delete(cb) }; } };
    const notifications = {
        setNotificationHandler() {},
        addNotificationReceivedListener: () => ({ remove() {} }),
        addNotificationResponseReceivedListener(cb) { responseListeners.add(cb); return { remove: () => responseListeners.delete(cb) }; },
        getLastNotificationResponseAsync: () => Promise.resolve(last),
        clearLastNotificationResponseAsync: async () => { actions.push('clear'); },
    };
    const api = load('lib/pushNotifications.ts', {
        'expo-router': { router: { navigate: (route) => actions.push(route) } },
        'expo-constants': { appOwnership: 'standalone' },
        'expo-secure-store': {}, '@react-native-async-storage/async-storage': {},
        'react-native': { AppState: appState, Platform: { OS: 'android' }, Keyboard: { dismiss: () => actions.push('dismiss') } },
        '@/lib/api': {}, 'expo-notifications': notifications,
    });
    const response = (id = 'push-1') => ({ actionIdentifier: 'default', notification: { request: { identifier: id, content: { data: { kind: 'chat_message', conversationId: 'conversation-1' } } } } });
    return {
        actions, response, start: api.addPushNotificationListeners,
        last(value) { last = value; },
        emit(value) { for (const cb of responseListeners) cb(value); },
        state(value) { appState.currentState = value; for (const cb of stateListeners) cb(value); },
    };
}

test('notification entry dismisses prior focus and uses one conversation navigation', async () => {
    const h = pushHarness();
    h.last(h.response());
    const stop = h.start();
    h.emit(h.response());
    await Promise.resolve();
    assert.equal(h.actions[0], 'dismiss');
    const routes = h.actions.filter((action) => typeof action === 'object');
    assert.equal(routes.length, 1);
    assert.equal(routes[0].pathname, '/conversation/[id]');
    assert.equal(routes[0].params.id, 'conversation-1');
    assert.equal(routes[0].params.notificationEntry, 'push-1:default');
    stop();
});

test('notification navigation waits for active app and cancels on listener disposal', async () => {
    const h = pushHarness('background');
    const stop = h.start();
    h.emit(h.response());
    assert.equal(h.actions.length, 0);
    h.state('active');
    assert.equal(h.actions.filter((value) => typeof value === 'object').length, 1);
    h.state('background');
    h.emit(h.response('push-2'));
    stop();
    h.state('active');
    await Promise.resolve();
    assert.equal(h.actions.filter((value) => typeof value === 'object').length, 1);
});

test('a stale startup response cannot navigate after listeners unmount', async () => {
    const h = pushHarness();
    h.last(h.response());
    const stop = h.start();
    stop();
    await Promise.resolve();
    assert.equal(h.actions.length, 0);
});

test('a live response takes precedence over an older startup response', async () => {
    const h = pushHarness();
    h.last(h.response('old-push'));
    const stop = h.start();
    h.emit(h.response('new-push'));
    await Promise.resolve();
    const routes = h.actions.filter((value) => typeof value === 'object');
    assert.equal(routes.length, 1);
    assert.equal(routes[0].params.notificationEntry, 'new-push:default');
    stop();
});

test('remounting listeners does not reopen an already handled push', async () => {
    const h = pushHarness();
    h.last(h.response());
    h.start()();
    const stop = h.start();
    await Promise.resolve();
    h.emit(h.response());
    assert.equal(h.actions.filter((value) => typeof value === 'object').length, 1);
    stop();
});

function modeHarness(os = 'android', entry = '', initialState = 'active') {
    const actions = [];
    const listeners = new Set();
    const reanimated = { height: { value: -300 }, progress: { value: 1 } };
    let focus;
    const state = { currentState: initialState, addEventListener(_event, cb) { listeners.add(cb); return { remove: () => listeners.delete(cb) }; } };
    const api = load('hooks/useConversationKeyboardMode.ts', {
        react: { useCallback: (cb) => cb, useRef: (value) => ({ current: value }) },
        'react-native': { Platform: { OS: os }, AppState: state, Keyboard: { dismiss: () => actions.push('blur') } },
        'expo-router': { useFocusEffect: (cb) => { focus = cb; } },
        'react-native-keyboard-controller': {
            useKeyboardContext: () => ({ reanimated }), AndroidSoftInputModes: { SOFT_INPUT_ADJUST_NOTHING: 48 },
            KeyboardController: { setInputMode: (mode) => actions.push(mode), setDefaultMode: () => actions.push('default'), dismiss: async () => { actions.push('dismiss'); } },
        },
    });
    api.useConversationKeyboardMode(entry);
    const cleanup = focus();
    return { actions, reanimated, cleanup, listeners, state(value) { state.currentState = value; for (const cb of listeners) cb(value); } };
}

test('Android notification focus resets stale offsets once and reapplies mode on resume', () => {
    const h = modeHarness('android', 'push-1');
    assert.equal(h.reanimated.height.value, 0);
    assert.equal(h.reanimated.progress.value, 0);
    assert.equal(h.actions.filter((value) => value === 'blur').length, 1);
    h.reanimated.height.value = -200;
    h.state('background');
    h.state('active');
    assert.equal(h.reanimated.height.value, -200, 'ordinary resume must not reset current typing');
    assert.equal(h.actions.filter((value) => value === 48).length, 2);
    h.cleanup();
    assert.equal(h.listeners.size, 0);
    assert.equal(h.actions.at(-1), 'default');
});

test('inactive notification entry is reconciled on first active state', () => {
    const h = modeHarness('android', 'push-1', 'background');
    assert.equal(h.reanimated.height.value, -300);
    h.state('active');
    assert.equal(h.reanimated.height.value, 0);
    h.cleanup();
});

test('normal conversation focus and iOS do not reset keyboard state', () => {
    const h = modeHarness();
    assert.equal(h.reanimated.height.value, -300);
    assert.deepEqual(h.actions, [48]);
    h.cleanup();
    const ios = modeHarness('ios', 'push-1');
    assert.deepEqual(ios.actions, []);
    assert.equal(ios.reanimated.height.value, -300);
});
