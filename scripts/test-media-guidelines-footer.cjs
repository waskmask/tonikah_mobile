const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../components/app/MediaGuidelinesModal.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const nodes = node => Array.isArray(node) ? node.flatMap(nodes)
    : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};

function render({ width = 390, gender = 'female', isRTL = false } = {}) {
    let acknowledged = 0;
    const palette = {
        chrome: { primary: 'pink', common: { card: 'card', primaryTint: 'tint' } },
        brand: { bg: { border: 'border', surface: 'surface' }, text: { subtitle: 'muted' },
            accent: { success: 'green', warning: 'amber' } },
    };
    const context = {
        exports: {},
        require(name) {
            if (name === 'react' || name === 'react/jsx-runtime') return require(name);
            if (name === 'react-native') return {
                Modal: 'Modal', ScrollView: 'ScrollView', View: 'View',
                StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width, height: 844 }),
            };
            if (name === 'react-native-safe-area-context') return { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' };
            if (name === 'expo-image') return { Image: 'Image' };
            if (name === '@/components/ui/icons/PhosphorCompat') return { CheckCircle2: 'CheckCircle2', EyeOff: 'EyeOff', ShieldAlert: 'ShieldAlert' };
            if (name === '@/components/ui/Text') return { Text: 'Text' };
            if (name === '@/components/ui/GradientButton') return { GradientButton: 'GradientButton' };
            if (name === '@/hooks/useColors') return { useColors: () => palette };
            if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL }) };
            if (name === '@/hooks/useResponsive') return { scale: value => value };
            if (name === '@/lib/profileDisplay') return { t: (_key, fallback) => fallback };
            if (name.endsWith('.webp')) return name;
            throw new Error(`Unexpected import ${name}`);
        },
    };
    vm.runInNewContext(compiled, context);
    const tree = context.exports.MediaGuidelinesModal({ visible: true, gender,
        onAcknowledge: () => acknowledged++ });
    return { tree, all: nodes(tree), acknowledged: () => acknowledged };
}

for (const width of [320, 390, 768]) {
    for (const gender of ['male', 'female']) {
        test(`guidelines footer stays outside scrolling content (width=${width}, gender=${gender})`, () => {
            const f = render({ width, gender, isRTL: gender === 'female' });
            const scroll = f.all.find(node => node.type === 'ScrollView');
            const footer = f.all.find(node => node.type === 'SafeAreaView');
            const button = f.all.find(node => node.type === 'GradientButton');
            assert.equal(f.tree.props.children.type, 'SafeAreaProvider');
            assert.ok(!nodes(scroll).includes(button), 'Button must not scroll away');
            assert.ok(nodes(footer).includes(button));
            const parent = f.all.find(node => Array.isArray(node.props?.children)
                && node.props.children.includes(scroll) && node.props.children.includes(footer));
            assert.ok(parent, 'Scroll area and footer must be siblings');
            assert.equal(flatten(scroll.props.style).flexShrink, 1);
            assert.equal(flatten(scroll.props.style).minHeight, 0);
            assert.equal(flatten(footer.props.style).flexShrink, 0);
            assert.equal(flatten(footer.props.style).paddingBottom, 8);
            assert.deepEqual([...footer.props.edges], width >= 640 ? [] : ['bottom']);
            assert.equal(flatten(parent.props.style).paddingBottom, undefined, 'No duplicate safe-area gap');
            assert.equal(flatten(parent.props.style).maxHeight, '94%');
            assert.equal(button.props.height, 44);
            assert.equal(button.props.title, 'I understand');
            assert.equal(button.props.widthMode, 'full');
            button.props.onPress();
            assert.equal(f.acknowledged(), 1);
            assert.equal(f.all.filter(node => node.type === 'Image').length, 2);
            assert.equal(f.all.some(node => node.type === 'EyeOff'), gender === 'female');
            f.tree.props.onRequestClose();
            assert.equal(f.acknowledged(), 1, 'System Back does not acknowledge the guidelines');
        });
    }
}
