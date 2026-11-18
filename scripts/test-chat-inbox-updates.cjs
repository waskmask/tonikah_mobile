const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const compile = (source) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
function moduleFrom(file, dependencies) {
    const module = { exports: {} };
    vm.runInNewContext(compile(read(file)), { module, exports: module.exports,
        require: (name) => {
            assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        } });
    return module.exports;
}
function expression(source, name) {
    const ast = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let result;
    function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
            result = ts.isCallExpression(node.initializer)
                ? node.initializer.arguments[0] : node.initializer;
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(result, name);
    return (env) => vm.runInNewContext(`(() => { ${compile(`const handler = ${result.getText(ast)};`)} return handler; })()`, env);
}
const screen = read('app/(tabs)/(main)/(messages)/messages.tsx');
const empty = () => ({ conversations: [], requests: [], sent: [], nextCursor: null, slots: null });
let inbox;
const queryClient = {
    getQueryData: () => inbox,
    setQueryData: (_key, update) => { inbox = typeof update === 'function' ? update(inbox) : update; },
};
const queryKeys = { chat: { inbox: ['chat', 'inbox'] } };
const cache = moduleFrom('lib/chatInboxCache.ts', {
    '@/lib/storage': { storage: {} }, '@/lib/queryClient': { queryClient }, '@/lib/queryKeys': { queryKeys },
});
cache.applyOutgoingRequest('new', 'peer', 'Name', { id: 'peer', avatar: 'authorized-thumb' });
assert.equal(inbox.sent[0].otherUser.avatar, 'authorized-thumb', 'seed before inbox ever mounts');
assert.equal(inbox.sent[0].requestRole, 'sent');
cache.applyOutgoingRequest('new', 'peer', 'Name');
assert.equal(inbox.sent.length, 1, 'already-pending response must not duplicate row');
assert.equal(inbox.sent[0].otherUser.avatar, 'authorized-thumb', 'preserve known metadata when omitted');
cache.applyOutgoingRequest('new', 'peer', 'Name', { id: 'peer', avatar: null });
assert.equal(inbox.sent[0].otherUser.avatar, null, 'explicit absence replaces old avatar');

const load = expression(screen, 'load');
function loadEnv(service) {
    const current = inbox;
    return {
        queryClient, queryKeys, chatService: service, ...current,
        normalizeConversation: (item, role) => ({ ...item, requestRole: role || null }),
        setConversations() {}, setRequests() {}, setSent() {}, setNextCursor() {}, setSlots() {},
    };
}
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
};
async function checkFetchRace(mutate) {
    inbox = empty();
    cache.applyOutgoingRequest('pending', 'peer', 'Peer', { id: 'peer', avatar: 'thumb' });
    const oldSent = inbox.sent;
    const response = deferred();
    const pending = load(loadEnv({
        conversations: async () => ({ success: true, items: [] }),
        incomingRequests: async () => ({ success: true, items: [] }),
        sentRequests: () => response.promise,
        slots: async () => ({ success: false }),
    }))('replace');
    mutate();
    const expected = inbox.sent;
    response.resolve({ success: true, items: oldSent });
    await pending;
    assert.equal(inbox.sent, expected, 'older fetch must not replace newly changed Sent cache');
}

async function main() {
    inbox = empty();
    inbox.conversations = [{ id: 'clear-me', lastMessagePreview: 'Old text', unreadCount: 2 }, { id: 'keep-me', lastMessagePreview: 'Keep' }];
    cache.applyClearedConversation('clear-me');
    assert.equal(inbox.conversations[0].historyCleared, true);
    assert.equal(inbox.conversations[0].lastMessagePreview, '');
    assert.equal(inbox.conversations[0].unreadCount, 0);
    assert.equal(inbox.conversations[1].lastMessagePreview, 'Keep');
    const preview = expression(screen, 'preview');
    const previewEnv = { isDeleted: false, previewLocked: false,
        conversation: inbox.conversations[0], variant: 'chats',
        t: (_key, fallback) => fallback, translateChatText: (value) => value };
    assert.equal(preview(previewEnv), 'Chat history cleared');
    previewEnv.conversation = { historyCleared: true, lastMessagePreview: 'New text' };
    assert.equal(preview(previewEnv), 'New text', 'new message replaces clear label');
    previewEnv.isDeleted = true;
    previewEnv.previewLocked = true;
    assert.equal(preview(previewEnv), 'Account deleted', 'deleted account must not show stale preview');
    for (const locale of fs.readdirSync(path.join(__dirname, '../locales'))) {
        const file = path.join(__dirname, '../locales', locale, 'chat.json');
        if (fs.existsSync(file)) assert.ok(JSON.parse(fs.readFileSync(file, 'utf8')).history_cleared, locale);
    }
    await checkFetchRace(() => cache.applyConversationStateById('pending', 'declined'));
    assert.equal(inbox.sent.length, 0, 'withdrawal stays removed');
    await checkFetchRace(() => cache.applyOutgoingRequest('newer', 'peer2', 'Peer 2', { id: 'peer2', avatar: 'new-thumb' }));
    assert.equal(inbox.sent[0].otherUser.avatar, 'new-thumb', 'new intro survives in-flight fetch');
    await load(loadEnv({
        conversations: async () => ({ success: true, items: [] }),
        incomingRequests: async () => ({ success: true, items: [] }),
        sentRequests: async () => ({ success: true, items: [{ id: 'server', otherUser: { id: 'p', avatar: 'fresh-thumb' } }] }),
        slots: async () => ({ success: false }),
    }))('replace');
    assert.equal(inbox.sent[0].id, 'server', 'fresh fetch still replaces list');
    assert.equal(inbox.sent[0].otherUser.avatar, 'fresh-thumb');
    const knownConversation = { id: 'loaded-page', state: 'active' };
    inbox.conversations = [knownConversation];
    inbox.nextCursor = 'keep-cursor';
    await load(loadEnv({
        conversations: () => { throw new Error('Pending refresh must not reload Chats'); },
        incomingRequests: async () => ({ success: true, items: [] }),
        sentRequests: async () => ({ success: true, items: [] }),
        slots: () => { throw new Error('Pending refresh must not reload slots'); },
    }))('pending');
    assert.equal(inbox.conversations[0], knownConversation, 'navigation refresh preserves loaded chat pages');
    assert.equal(inbox.nextCursor, 'keep-cursor');

    const action = expression(screen, 'runRequestAction');
    for (const outcome of ['success', 'failure', 'throw']) {
        inbox = empty();
        cache.applyOutgoingRequest('request', 'peer', 'Peer');
        const response = deferred();
        let calls = 0;
        const requestActionIdsRef = { current: new Set() };
        let busy;
        const env = { ...cache, requestActionIdsRef,
            setBusyRequestIds: (value) => { busy = value; },
            chatService: { withdraw: () => { calls++; return response.promise; } },
            apiMessage: (message) => message, toast: { show() {} },
        };
        const run = action(env);
        const first = run(inbox.sent[0], 'withdraw');
        await run(inbox.sent[0], 'withdraw');
        assert.equal(calls, 1, 'synchronous lock prevents duplicate requests');
        assert.equal(busy.has('request'), true);
        response.resolve(outcome === 'success' ? { success: true } : outcome === 'failure'
            ? { success: false, message: 'network_error' } : Promise.reject(new Error('network')));
        await first;
        assert.equal(inbox.sent.length, outcome === 'success' ? 0 : 1, 'remove only after confirmed success');
        assert.equal(busy.size, 0, 'success and errors release button lock');
        assert.equal(requestActionIdsRef.current.size, 0);
    }

    for (const operation of ['accept', 'decline']) {
        inbox = empty();
        const request = { id: 'incoming', state: 'request_pending', otherUser: { id: 'peer' } };
        inbox.requests = [request];
        inbox.slots = { used: 0, total: 3 };
        let opened = 0;
        let allowed = false;
        let calls = 0;
        const locks = { current: new Set() };
        const run = action({ ...cache, requestActionIdsRef: locks, setBusyRequestIds() {},
            requireConversationAccess: async () => allowed,
            chatService: { [operation]: async () => { calls++; return { success: true }; } },
            setActiveTab: (tab) => assert.equal(tab, 'chats'),
            openConversation: () => { opened++; },
        });
        if (operation === 'accept') {
            await run(request, operation);
            assert.equal(calls, 0, 'accept retains membership/verification gate');
            assert.equal(locks.current.size, 0);
        }
        allowed = true;
        await run(request, operation);
        assert.equal(calls, 1);
        assert.equal(inbox.requests.length, 0);
        assert.equal(opened, operation === 'accept' ? 1 : 0);
        if (operation === 'accept') {
            assert.equal(inbox.conversations[0].state, 'active');
            assert.equal(inbox.slots.used, 1);
        }
        assert.equal(locks.current.size, 0);
    }

    let cursor = 0;
    const slots = [];
    const slot = (init) => { const i = cursor++; if (!(i in slots)) slots[i] = init(); return i; };
    const jsx = (type, props, key) => ({ type, props, key });
    const { ConversationAvatar } = moduleFrom('components/chat/ConversationAvatar.tsx', {
        react: {
            useState: (value) => { const i = slot(() => value); return [slots[i], (next) => { slots[i] = next; }]; },
            useRef: (value) => slots[slot(() => ({ current: value }))],
        },
        'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
        'react-native': { StyleSheet: { absoluteFill: {} } },
        'expo-image': { Image: 'Image' }, '@/lib/profileAssets': { PROFILE_PLACEHOLDER_IMAGE: 'placeholder' },
    });
    const avatar = (identity, uri) => { cursor = 0; return ConversationAvatar({ identity, uri }).props.children; };
    let images = avatar('a', null);
    assert.equal(images[0].props.source, 'placeholder');
    assert.equal(images[1], false, 'missing photo uses actual placeholder, not initials');
    images = avatar('a', 'url-a');
    const oldError = images[1].props.onError;
    images[1].props.onError();
    assert.equal(avatar('a', 'url-a')[1], false, 'failed image exposes placeholder');
    images = avatar('b', 'url-b');
    images[1].props.onError();
    oldError();
    assert.equal(avatar('b', 'url-b')[1], false, 'old image error cannot undo current failure');
    assert.ok(avatar('b', 'new-url')[1], 'changed URL can load again');
    assert.ok(avatar('c', 'url-a')[1], 'recycled row identity can load independently');

    assert.ok(screen.includes('keyboardShouldPersistTaps="handled"'));
    assert.ok(screen.includes('initialLoadFinishedRef.current') && screen.includes("loadRef.current('pending')"));
    assert.ok(screen.includes('<ConversationAvatar') && !screen.includes('{initial}'));
    const conversation = read('app/conversation/[id].tsx');
    assert.ok(conversation.includes('<ConversationAvatar') && conversation.includes('profileAvatarImage(headerOther)'));
    const intro = read('components/profile/UserProfileView.tsx');
    assert.equal(intro.split('applyOutgoingRequest(res.conversationId, id, name, recipient)').length - 1, 2);
    console.log('Chat inbox checks passed (intro avatar seed, cold cache, request races, withdrawal lock/errors, fresh fetch, shared avatar fallback/recycling).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
