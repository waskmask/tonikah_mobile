const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const file = path.join(__dirname, '../app/conversation/[id].tsx');
const source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['runConversationMenuAction', 'endConversation', 'deleteConversation', 'confirmConversationAction', 'closeConversationMenu'];
const declarations = new Map();
function visit(node) {
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) declarations.set(node.name.getText(ast), node.getText(ast));
    ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(declarations.size, names.length);

function fixture() {
    const events = [];
    const calls = [];
    const ref = { current: null };
    const scope = { current: { id: 'conversation-fixture', focused: true } };
    const state = { open: true, stage: null, busy: false, conversation: { id: 'conversation-fixture', muted: false } };
    let response = Promise.resolve({ success: true });
    const moduleFixture = { exports: {} };
    const code = `
        const conversation = state.conversation;
        const id = 'conversation-fixture';
        const menuBusy = false; // Simulate a second tap before React re-renders.
        let conversationConfirmation = null;
        const menuRequestRef = ref;
        const menuScopeRef = scope;
        const setMenuBusy = value => { state.busy = value; };
        const setMenuOpen = value => { state.open = value; };
        const setConversationConfirmation = value => { conversationConfirmation = value; state.stage = value; };
        const setConversation = update => { state.conversation = update(state.conversation); };
        const toast = { show: (...args) => events.push(['toast', ...args]) };
        const apiMessage = text => text;
        const translateChatText = (_key, fallback) => fallback;
        const load = async mode => events.push(['load', mode]);
        const historyVersionRef = { current: 0 };
        const user = { id: 'viewer' };
        const applyClearedConversation = id => events.push(['cleared', id]);
        const setItems = items => events.push(['items', items.length]);
        const clearCachedMessages = async (userId, id) => events.push(['clear-cache', userId, id]);
        const goBackToMessages = () => events.push(['back']);
        ${names.map((name) => `const ${declarations.get(name)};`).join('\n')}
        module.exports = { ${names.join(',')}, cancel: () => setConversationConfirmation(null) };
    `;
    vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
        module: moduleFixture, state, events, ref, scope,
        chatService: Object.fromEntries(['mute', 'end', 'deleteConversation'].map((method) => [method, (...args) => {
            calls.push([method, ...args]);
            return response;
        }])),
    });
    return { ...moduleFixture.exports, state, events, calls, ref, scope, response(value) { response = value; } };
}

(async () => {
    {
        const f = fixture();
        f.closeConversationMenu();
        assert.equal(f.state.open, false, 'immediate X/backdrop close needs no native lifecycle callback');
        assert.deepEqual(f.calls, []);
    }
    for (const action of ['end', 'delete']) {
        const f = fixture();
        (action === 'end' ? f.endConversation : f.deleteConversation)();
        assert.equal(f.state.open, true, 'confirmation stays in the same host');
        assert.equal(f.state.stage, action);
        assert.deepEqual(f.calls, [], 'opening confirmation makes no request');
        f.cancel();
        assert.equal(f.state.stage, null, 'Cancel returns to options');
        assert.equal(f.state.open, true);
        (action === 'end' ? f.endConversation : f.deleteConversation)();
        const first = f.confirmConversationAction();
        const duplicate = f.confirmConversationAction();
        f.closeConversationMenu();
        assert.equal(f.state.open, true, 'cannot close during an active request');
        await Promise.all([first, duplicate]);
        assert.equal(f.calls.length, 1, 'rapid confirmation cannot duplicate request');
        assert.equal(f.calls[0][0], action === 'end' ? 'end' : 'deleteConversation');
        assert.equal(f.calls[0][1], 'conversation-fixture');
        assert.equal(f.state.open, false);
        assert.equal(f.state.busy, false);
        assert.equal(f.ref.current, null);
        assert.ok(f.events.some((event) => event[0] === (action === 'end' ? 'load' : 'back')));
    }
    for (const failure of ['api', 'throw']) {
        const f = fixture();
        f.response(failure === 'api' ? Promise.resolve({ success: false, message: 'fixture-error' }) : Promise.reject(new Error('fixture')));
        f.deleteConversation();
        await f.confirmConversationAction();
        assert.equal(f.state.open, true, 'failure leaves retryable confirmation');
        assert.equal(f.state.stage, 'delete');
        assert.equal(f.state.busy, false, 'finally releases request state');
        assert.equal(f.ref.current, null);
        assert.ok(f.events.some((event) => event[0] === 'toast' && event[2] === 'error'));
        f.closeConversationMenu();
        assert.equal(f.state.open, false);
    }
    {
        const f = fixture();
        await f.runConversationMenuAction('mute');
        assert.equal(f.calls[0][0], 'mute');
        assert.equal(f.calls[0][2], true);
        assert.equal(f.state.conversation.muted, true);
        assert.equal(f.state.open, false);
        assert.equal(f.state.busy, false);
    }
    {
        const f = fixture();
        let resolve;
        f.response(new Promise((ready) => { resolve = ready; }));
        f.deleteConversation();
        const request = f.confirmConversationAction();
        f.scope.current = { id: 'other-conversation', focused: true };
        f.ref.current = null; // Effect cleanup on route/focus change.
        resolve({ success: true });
        await request;
        assert.deepEqual(f.events, [], 'late response cannot navigate or toast on another route');
    }

    const sheet = fs.readFileSync(path.join(__dirname, '../components/chat/ConversationOptionsSheet.tsx'), 'utf8');
    assert.equal((source.match(/<ConversationOptionsSheet\b/g) || []).length, 1);
    assert.equal(source.includes('<ConfirmSheet'), false, 'no sibling native confirmation');
    assert.equal(sheet.includes('<Modal'), false, 'options sheet has no native modal');
    assert.equal(sheet.includes('<BottomSheet\n'), true);
    assert.equal(sheet.includes('animateOnMount={false}'), true, 'no opening-animation close guard');
    assert.ok(sheet.includes('BottomSheetScrollView'), 'long confirmation content remains scrollable');
    console.log('Conversation options checks passed (single host, immediate close, confirmation cancel, duplicate lock, failure cleanup, mute, stale response).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
