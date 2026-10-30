const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function clock() {
    let now = 100_000;
    let sequence = 0;
    const timers = new Map();
    return {
        Date: class extends Date { static now() { return now; } },
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        advance(ms) {
            const target = now + ms;
            for (;;) {
                const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
                if (!next || next[1].at > target) break;
                now = next[1].at; timers.delete(next[0]); next[1].callback();
            }
            now = target;
        },
        timers,
    };
}

function evaluate(source, context) {
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(code, context);
    return context.exports;
}

function read(file) { return fs.readFileSync(path.join(__dirname, '..', file), 'utf8'); }

test('typing bubble is measured above the composer, outside the inverted/clipped message list', () => {
    const source = read('app/conversation/[id].tsx');
    const ast = ts.createSourceFile('conversation.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let bar;
    let bubble;
    const lists = [];
    const visit = (node) => {
        if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'ChatComposerBar') bar = node;
        if (ts.isFunctionDeclaration(node) && node.name?.text === 'TypingIndicatorBubble') bubble = node;
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'FlatList') lists.push(node);
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.ok(bar && bubble && lists.length);
    const content = bar.getText(ast);
    assert.match(content, /onContentLayout/);
    assert.match(content, /setComposerHeight/);
    assert.match(content, /peerTyping\s*\?/);
    assert.match(content, /pointerEvents="none" style=\{styles\.typingSlot\}/);
    assert.ok(content.indexOf('<TypingIndicatorBubble') < content.indexOf('styles.composer}'));
    assert.equal((source.match(/<TypingIndicatorBubble\b/g) || []).length, 1);
    for (const list of lists) assert.doesNotMatch(list.getText(ast), /TypingIndicatorBubble/);
    assert.doesNotMatch(bubble.getText(ast), /exiting=/, 'no detached exit animation after measured row disappears');
});

async function socketHarness() {
    const listeners = new Map();
    const client = { connected: true, sent: [],
        on(name, fn) { listeners.set(name, fn); },
        emit(name, payload) { this.sent.push({ name, payload }); },
        disconnect() { this.connected = false; }, removeAllListeners() { listeners.clear(); },
    };
    const time = clock();
    let user = { _id: 'A' };
    let onAppState;
    const appState = { currentState: 'active', addEventListener(_name, fn) {
        onAppState = fn;
        return { remove() { onAppState = null; } };
    } };
    const mocks = {
        'socket.io-client': { io: () => client },
        'react-native': { AppState: appState },
        '@/constants/config': { Config: { API_URL: 'http://local.invalid/api' } },
        '@/lib/api': { api: { getTokens: async () => ({ accessToken: 'test-only' }) } },
        '@/store/authStore': { useAuthStore: { getState: () => ({ user }) } },
    };
    const { chatSocket } = evaluate(read('lib/chatSocket.ts'), { exports: {}, ...time,
        require(name) { if (name in mocks) return mocks[name]; return {}; },
    });
    const received = [];
    const stop = chatSocket.subscribe(() => ({ conversationId: 'AB',
        onTyping: (payload) => received.push(['start', payload]),
        onStopTyping: (payload) => received.push(['stop', payload]),
    }));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    listeners.get('connect')();
    return { client, listeners, chatSocket, received, stop, time, account(value) { user = value; },
        background() { appState.currentState = 'background'; onAppState('background'); },
    };
}

test('native singleton rejects self/malformed/wrong-conversation typing and dispatches peer start/stop', async () => {
    const h = await socketHarness();
    for (const name of ['chat:typing', 'chat:stop-typing']) {
        for (const payload of [null, {}, { conversationId: 'AB' }, { userId: 'B' },
            { conversationId: 'AB', userId: 'A' }, { conversationId: 'AC', userId: 'B' }]) {
            h.listeners.get(name)(payload);
        }
        h.listeners.get(name)({ conversationId: 'AB', userId: 'B' });
    }
    assert.deepEqual(h.received.map(([name]) => name), ['start', 'stop']);
    h.account({ id: 'B' });
    h.listeners.get('chat:typing')({ conversationId: 'AB', userId: 'B' });
    h.account(null);
    h.listeners.get('chat:typing')({ conversationId: 'AB', userId: 'A' });
    assert.equal(h.received.length, 2);
    h.stop(); h.time.advance(4000);
    assert.equal(h.listeners.size, 0);
});

test('native singleton never buffers typing on a disconnected socket', async () => {
    const h = await socketHarness();
    h.chatSocket.sendTyping('AB', 'B');
    h.chatSocket.stopTyping('AB', 'B');
    assert.equal(h.client.sent.length, 2);
    h.client.connected = false;
    h.chatSocket.sendTyping('AB', 'B'); h.chatSocket.stopTyping('AB', 'B');
    assert.equal(h.client.sent.length, 2);
    h.stop(); h.time.advance(4000);
});

test('native singleton emits pending typing stops before background disconnect and clears tracking', async () => {
    const h = await socketHarness();
    h.chatSocket.sendTyping('AB', 'B');
    h.background();
    assert.equal(h.client.sent.at(-1).name, 'chat:stop-typing');
    assert.equal(h.client.sent.at(-1).payload.conversationId, 'AB');
    assert.equal(h.client.connected, false);
    h.stop(); h.time.advance(4000);
    assert.equal(h.client.sent.length, 2);
});

test('hook uses the live conversation for starts and the captured conversation for cleanup stops', () => {
    const sent = [];
    const refs = [];
    let cursor = 0;
    const { useChatSocket } = evaluate(read('hooks/useChatSocket.ts'), { exports: {}, require(name) {
        if (name === 'react') return {
            useRef(value) { const index = cursor++; return refs[index] ||= { current: value }; },
            useState: (value) => [value, () => {}], useEffect() {},
        };
        if (name === '@/lib/chatSocket') return { chatSocket: {
            isConnected: () => true,
            sendTyping: (...args) => sent.push(['start', ...args]),
            stopTyping: (...args) => sent.push(['stop', ...args]),
        } };
        throw Error(name);
    } });
    const first = useChatSocket({ conversationId: 'AB' });
    cursor = 0;
    const second = useChatSocket({ conversationId: 'AC' });
    second.sendTyping('C');
    first.stopTyping('B', 'AB');
    assert.deepEqual(sent, [['start', 'AC', 'C'], ['stop', 'AB', 'B']]);
});

function screenHarness() {
    const time = clock();
    const listeners = new Set();
    const AppState = { currentState: 'active', addEventListener(_event, fn) { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } };
    const sent = [];
    let typing = false;
    let effects = [];
    let previous = [];
    const callbacks = [];
    let callbackCursor = 0;
    const sameDeps = (a, b) => a?.length === b.length && b.every((value, index) => Object.is(value, a[index]));
    const socket = { connected: true };
    const refs = {
        typingStopTimerRef: { current: null }, typingActiveRef: { current: false },
        lastTypingSentAtRef: { current: 0 }, peerTypingClearRef: { current: null },
        socketRef: { current: {
            sendTyping: (peer) => sent.push(['start', peer]),
            stopTyping: (peer, conversation) => sent.push(['stop', peer, conversation]),
        } },
    };
    const source = read('app/conversation/[id].tsx');
    const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const component = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'ConversationScreen');
    // Isolate the actual typing callbacks and lifecycle effects from the large screen.
    const names = ['handleSocketTyping', 'handleSocketStopTyping', 'emitStopTyping', 'handleComposerChange'];
    const selected = component.body.statements.filter((node) =>
        ts.isVariableStatement(node) && node.declarationList.declarations.some((decl) => names.includes(decl.name.getText(ast)))
        || ts.isExpressionStatement(node) && (node.getText(ast).includes('const clearTyping = () =>') || node.getText(ast).includes('if (!isFocused || !socket.connected)')));
    const api = evaluate('exports.render = (id, peerId, isFocused, user, conversation) => {\n'
        + selected.map((node) => node.getText(ast)).join('\n')
        + '\nreturn {handleComposerChange, emitStopTyping, handleSocketTyping, handleSocketStopTyping}; };', {
        exports: {}, ...time, ...refs, AppState, socket,
        useCallback(fn, deps) {
            const index = callbackCursor++;
            if (!sameDeps(callbacks[index]?.deps, deps)) callbacks[index] = { fn, deps };
            return callbacks[index].fn;
        },
        useEffect: (fn, deps) => effects.push({ fn, deps }),
        setContent() {}, setPeerTyping(value) { typing = value; },
    });
    function render(id = 'AB', peer = 'B', focused = true, user = { _id: 'A' }) {
        effects = [];
        callbackCursor = 0;
        const handlers = api.render(id, peer, focused, user, { otherUser: { id: peer } });
        previous = effects.map((effect, index) => {
            const old = previous[index];
            if (sameDeps(old?.deps, effect.deps)) return old;
            old?.close?.();
            return { ...effect, close: effect.fn() };
        });
        return handlers;
    }
    return {
        render, time, sent, socket, listeners,
        get typing() { return typing; },
        background() { AppState.currentState = 'background'; for (const fn of listeners) fn('background'); },
        close() { for (const effect of previous) effect.close?.(); },
    };
}

test('screen refreshes continuous input beyond receiver expiry, stops on idle and empty input', () => {
    const h = screenHarness();
    const screen = h.render();
    for (let i = 0; i < 20; i++) { screen.handleComposerChange('text'); h.time.advance(500); }
    assert.ok(h.sent.filter(([name]) => name === 'start').length >= 6);
    assert.equal(h.sent.filter(([name]) => name === 'stop').length, 0);
    h.time.advance(2500);
    assert.equal(h.sent.at(-1)[0], 'stop');
    screen.handleComposerChange('text'); screen.handleComposerChange('   ');
    assert.equal(h.sent.at(-1)[0], 'stop');
    assert.equal(h.time.timers.size, 0);
    h.close();
});

test('ordinary screen rerenders keep typing timers and do not emit premature stops', () => {
    const h = screenHarness();
    h.render().handleComposerChange('text');
    h.render();
    assert.equal(h.sent.length, 1);
    assert.equal(h.time.timers.size, 1);
    h.close();
});

test('screen validates sender/peer/conversation and replaces lost-stop expiry', () => {
    const h = screenHarness();
    const screen = h.render();
    for (const payload of [{ conversationId: 'AB', userId: 'A' }, { conversationId: 'AC', userId: 'B' },
        { conversationId: 'AB', userId: 'C' }, { conversationId: 'AB' }]) screen.handleSocketTyping(payload);
    assert.equal(h.typing, false);
    const peer = { conversationId: 'AB', userId: 'B' };
    screen.handleSocketTyping(peer); h.time.advance(5000); screen.handleSocketTyping(peer);
    screen.handleSocketStopTyping({ conversationId: 'AB', userId: 'A' });
    assert.equal(h.time.timers.size, 1);
    h.time.advance(1000); assert.equal(h.typing, true);
    h.time.advance(5000); assert.equal(h.typing, false);
    screen.handleSocketTyping(peer); screen.handleSocketStopTyping(peer);
    assert.equal(h.typing, false); assert.equal(h.time.timers.size, 0);
    h.close();
});

test('screen clears typing on background, blur, disconnect, account change, route change and unmount', () => {
    for (const action of ['background', 'blur', 'disconnect', 'account', 'route', 'unmount']) {
        const h = screenHarness();
        const screen = h.render();
        screen.handleComposerChange('text');
        screen.handleSocketTyping({ conversationId: 'AB', userId: 'B' });
        if (action === 'background') h.background();
        if (action === 'blur') h.render('AB', 'B', false);
        if (action === 'disconnect') { h.socket.connected = false; h.render(); }
        if (action === 'account') h.render('AB', 'B', true, { id: 'D' });
        if (action === 'route') h.render('AC', 'C');
        if (action === 'unmount') h.close();
        assert.equal(h.typing, false, action);
        assert.equal(h.time.timers.size, 0, action);
        assert.deepEqual(h.sent.at(-1), ['stop', 'B', 'AB'], action);
        h.close();
        assert.equal(h.listeners.size, 0, action);
    }
});
