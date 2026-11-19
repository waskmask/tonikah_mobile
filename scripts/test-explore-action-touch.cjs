const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.join(__dirname, '../components/explore/ExploreActionBar.tsx');
const source = fs.readFileSync(file, 'utf8');
let dark = false;
const jsx = (type, props) => ({ type, props });
const colors = { chrome: { common: {}, primary: '#f00' }, brand: { gradient: {} } };
const modules = {
    react: { useState: () => [false, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: (s) => s } },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'phosphor-react-native': {},
    '@/hooks/useResponsive': { scale: (n) => n },
    '@/hooks/useColors': { useColors: () => colors },
    '@/hooks/useTheme': { useTheme: () => ({ isDark: dark }) },
};
const context = { exports: {}, require: (id) => modules[id] || {} };
vm.runInNewContext(ts.transpileModule(source + '\nexports.testCircle = Circle;', {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const flatten = (s) => Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean).map(flatten)) : s;
const find = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'Pressable') return node;
    for (const child of [node.props?.children].flat()) {
        const found = find(child);
        if (found) return found;
    }
    return null;
};
for (dark of [false, true]) {
    for (const [key, tone, size] of [['undo', 'neutral', 'sm'], ['skip', 'skip', 'md'], ['view', 'view', 'md'], ['favorite', 'primary', 'sm']]) {
        for (const disabled of [false, true]) {
            let calls = 0;
            const tree = context.exports.testCircle({ buttonKey: key, tone, size, disabled,
                activeKey: null, accessibilityLabel: key, onPress: () => calls++, children: 'icon' });
            const press = find(tree);
            assert.ok(press);
            assert.notEqual(typeof press.props.style, 'function');
            const style = flatten(press.props.style);
            assert.ok(style.width === (size === 'md' ? 56 : 48) || style.width === '100%');
            assert.ok(style.height === (size === 'md' ? 56 : 48) || style.height === '100%');
            assert.equal(press.props.disabled, disabled);
            assert.equal(press.props.accessibilityState.disabled, disabled);
            press.props.onPress();
            assert.equal(calls, 1);
        }
    }
}
console.log('Explore action touch checks passed (four actions, both themes, full sizing, disabled semantics, callback wiring).');
