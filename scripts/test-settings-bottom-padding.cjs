const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function padding(platform, bottom, factor = 1) {
    const source = fs.readFileSync(path.join(root, 'components/settings/useSettingsBottomPadding.ts'), 'utf8');
    const context = { exports: {}, require(name) {
        if (name === 'react-native') return { Platform: { OS: platform } };
        if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom }) };
        if (name === '@/hooks/useResponsive') return { scale: n => n * factor };
        throw new Error(`Unexpected import ${name}`);
    } };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
    return context.exports.useSettingsBottomPadding();
}

test('Settings reuses hub clearance with iOS safe area exactly once, unscaled', () => {
    assert.equal(padding('ios', 0), 120);
    assert.equal(padding('ios', 34), 154);
    assert.equal(padding('ios', 34, 1.25), 184);
});

test('Android native tabs already reserve the bottom safe area', () => {
    for (const inset of [0, 24, 48]) assert.equal(padding('android', inset), 120);
    assert.equal(padding('web', 0), 120);
});

const pages = ['settings', 'settings-account', 'settings-privacy', 'settings-security', 'settings-notifications',
    'language', 'change-email', 'set-password', 'delete-account', 'blocked-users', 'verifications', 'phone-verification', 'memberships'];

for (const page of pages) test(`${page}: main content uses shared clearance, not a second safe-area inset`, () => {
    const file = path.join(root, `app/(tabs)/(main)/(profile)/${page}.tsx`);
    const source = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const contentStyles = [];
    const visit = node => {
        if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'contentContainerStyle') contentStyles.push(node.getText(ast));
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.match(source, /const bottomPadding = useSettingsBottomPadding\(\)/);
    assert.equal(contentStyles.length, 1, 'only the main scrolling surface is changed');
    assert.match(contentStyles[0], /paddingBottom: bottomPadding/);
    assert.doesNotMatch(contentStyles[0], /insets\.bottom/);
});
