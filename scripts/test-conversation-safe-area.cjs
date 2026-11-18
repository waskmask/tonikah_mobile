const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const file = path.join(__dirname, '../app/conversation/[id].tsx');
const source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let screenStyle;
const roots = [];
let headerOutsideKeyboard = false;
function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'screenStyle') screenStyle = node.initializer;
    if (ts.isJsxElement(node)) {
        const opening = node.openingElement;
        const sharedStyle = opening.attributes.properties.some((prop) => ts.isJsxAttribute(prop)
            && prop.name.getText(ast) === 'style' && prop.initializer?.getText(ast) === '{screenStyle}');
        if (sharedStyle) roots.push(opening.tagName.getText(ast));
        if (opening.attributes.getText(ast).includes('styles.header,') && opening.tagName.getText(ast) === 'View') {
            let parent = node.parent;
            let inKeyboard = false;
            while (parent) {
                if (ts.isJsxElement(parent) && ['ChatKeyboardAvoider', 'ChatKeyboardViewport', 'ChatStickyComposer'].includes(parent.openingElement.tagName.getText(ast))) inKeyboard = true;
                parent = parent.parent;
            }
            headerOutsideKeyboard = !inKeyboard;
        }
    }
    ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(screenStyle);
assert.deepEqual(roots, ['View', 'View', 'View', 'View', 'View'], 'all loading/gated/ready branches share one inset owner');
assert.equal(source.includes('<SafeAreaView'), false, 'no duplicate native inset consumer');
assert.equal(headerOutsideKeyboard, true);
assert.equal(screenStyle.getText(ast).includes('loading'), false, 'loading cannot change reserved top space');
for (const top of [0, 20, 24, 44, 59, 62]) {
    const style = vm.runInNewContext(`(${screenStyle.getText(ast)})`, {
        styles: { screen: { flex: 1 } },
        colors: { bg: 'fixture-background' },
        insets: { top, bottom: 34 },
    });
    assert.equal(style[1].paddingTop, top, 'use live inset without hardcoded status-bar height');
    assert.equal(style[1].paddingBottom, undefined, 'bottom keyboard/composer inset remains independent');
    assert.equal(style[1].transform, undefined);
    assert.equal(style[0].flex, 1);
}
console.log('Conversation safe-area checks passed (shared shell padding, live insets, no double padding, header outside keyboard).');
