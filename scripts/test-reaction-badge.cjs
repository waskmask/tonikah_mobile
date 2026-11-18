const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Render the actual reaction JSX in isolation; native emoji glyph bounds must
// still be checked on iPhone, not inferred from these structural checks.
const filename = path.join(__dirname, '../app/conversation/[id].tsx');
const source = fs.readFileSync(filename, 'utf8');
const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let reactionMap;
let sizeDeclaration;
let styleObject;
function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'reactions.map') reactionMap = node.arguments[0];
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'reactionBadgeSize') sizeDeclaration = node;
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'StyleSheet.create') styleObject = node.arguments[0];
    ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(reactionMap && sizeDeclaration && styleObject);
const badgeStyles = styleObject.properties.filter((property) => ['reactionPill', 'reactionText'].includes(property.name?.getText(ast)));
const fixtureSource = `
const styles = { ${badgeStyles.map((property) => property.getText(ast)).join(',')} };
export function renderReaction(reaction, index, os, fontScale) {
    const Platform = { OS: os };
    const colors = { card: 'white', border: 'grey' };
    const ${sizeDeclaration.getText(ast)};
    return (${reactionMap.getText(ast)})(reaction, index);
}`;
const compiled = ts.transpileModule(fixtureSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const jsx = (type, props, key) => ({ type, props, key });
const moduleFixture = { exports: {} };
vm.runInNewContext(compiled, {
    module: moduleFixture,
    exports: moduleFixture.exports,
    require: (name) => {
        assert.equal(name, 'react/jsx-runtime');
        return { jsx, jsxs: jsx };
    },
    StyleSheet: { hairlineWidth: 0.5 },
    scale: (value) => value,
    reactionEmoji: (reaction) => reaction.emoji,
    Reanimated: { View: 'AnimatedView' },
    RNText: 'NativeText',
    Text: 'AppText',
    ZoomIn: { springify: () => ({ damping: () => 'zoom-in' }) },
    ZoomOut: { duration: () => 'zoom-out' },
});

const flatten = (style) => Object.assign({}, ...style.filter(Boolean));
const emojis = ['\u2764\ufe0f', '\ud83d\udc4d', '\ud83d\ude02', '\ud83d\ude2e', '\ud83d\ude22', '\ud83d\ude4f', '\ud83d\udc4d\ud83c\udffd'];
for (const emoji of emojis) {
    for (const fontScale of [0.5, 0.8, 1, 1.5, 2, 3]) {
        const badge = moduleFixture.exports.renderReaction({ user: 'fixture', emoji }, 0, 'ios', fontScale);
        const style = flatten(badge.props.style);
        const text = badge.props.children;
        assert.equal(style.width, style.height, 'iOS badge remains round');
        assert.equal(style.minWidth, style.width, 'base minimum cannot stretch small circles');
        assert.equal(style.borderRadius, style.width / 2);
        assert.ok(style.height - 2 * style.borderWidth >= text.props.style.fontSize * 1.5, 'room for natural emoji metrics');
        assert.equal(text.type, 'NativeText');
        assert.equal(text.props.children, emoji, 'complete emoji sequence preserved');
        assert.equal(text.props.style.fontFamily, undefined);
        assert.equal(text.props.style.lineHeight, undefined);
        assert.equal(text.props.allowFontScaling, false, 'font size already includes accessibility scale');
        assert.equal(text.props.style.fontSize, 12 * fontScale);
        assert.equal(style.backgroundColor, 'white');
        assert.equal(style.shadowOpacity, 0.08);
        assert.equal(badge.props.entering, 'zoom-in');
        assert.equal(badge.props.exiting, 'zoom-out');
    }
    const android = moduleFixture.exports.renderReaction({ user: 'fixture', emoji }, 0, 'android', 2);
    const style = flatten(android.props.style);
    assert.equal(style.height, 20);
    assert.equal(style.minWidth, 20);
    assert.equal(style.width, undefined);
    assert.equal(style.borderRadius, 10);
    assert.equal(style.paddingVertical, 2);
    assert.equal(android.props.children.type, 'AppText');
    assert.equal(android.props.children.props.style.fontSize, 12);
    assert.equal(android.props.children.props.style.lineHeight, 13);
    assert.equal(android.props.children.props.children, emoji);
}
assert.equal(moduleFixture.exports.renderReaction({ emoji: '' }, 0, 'ios', 1), null);
console.log('Reaction badge checks passed (round iOS geometry, natural metrics, accessibility scale, emoji sequences, unchanged Android).');
