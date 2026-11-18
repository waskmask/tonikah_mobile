const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const file = path.join(__dirname, '../app/(tabs)/(main)/(messages)/messages.tsx');
const source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let selectTab;
let focusLifecycle;
let input;
let tabPress;
function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'selectTab') {
        selectTab = node.initializer.arguments[0];
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect'
        && node.getText(ast).includes('searchInputRef.current?.blur()')) {
        focusLifecycle = node.arguments[0].arguments[0];
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'TextInput') input = node;
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onPress'
        && node.initializer?.getText(ast).includes('selectTab(key)')) tabPress = node;
    ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(selectTab && focusLifecycle && input && tabPress, 'real screen wires tab and focus boundaries');
assert.ok(input.attributes.properties.some((prop) => prop.name?.getText(ast) === 'ref'
    && prop.initializer?.getText(ast) === '{searchInputRef}'));
assert.equal(input.attributes.properties.some((prop) => prop.name?.getText(ast) === 'autoFocus'), false);

function evaluate(node, env) {
    const compiled = ts.transpileModule(`const handler = ${node.getText(ast)};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2020 },
    }).outputText;
    return vm.runInNewContext(`(() => { ${compiled}\nreturn handler; })()`, env);
}
for (const platform of ['ios', 'android']) {
    for (const target of ['chats', 'requests', 'sent', 'closed']) {
        const events = [];
        const env = {
            Platform: { OS: platform },
            activeTab: 'chats',
            searchInputRef: { current: { blur: () => events.push('blur') } },
            setActiveTab: (tab) => events.push(tab),
        };
        evaluate(selectTab, env)(target);
        assert.deepEqual(events, platform === 'ios' && target !== 'chats'
            ? ['blur', target] : [target]);
        events.length = 0;
        const cleanup = evaluate(focusLifecycle, env)();
        assert.deepEqual(events, [], 'entering Messages must not dismiss a fresh search tap');
        cleanup();
        assert.deepEqual(events, platform === 'ios' ? ['blur'] : [], 'only iOS search is blurred on leaving');
        env.searchInputRef.current = null;
        assert.doesNotThrow(() => evaluate(selectTab, env)(target));
        assert.doesNotThrow(cleanup);
    }
}
for (const handler of [selectTab, focusLifecycle]) {
    const text = handler.getText(ast);
    assert.equal(/setSearch|Keyboard\.|KeyboardController\.|setTimeout|requestAnimationFrame|\.focus\(/.test(text), false,
        'no query clearing, global dismissal, deferred dismissal, or forced focus');
}
console.log('Messages search focus checks passed (iOS boundary blur, preserved query, Android unchanged, no deferred/global dismissal).');
