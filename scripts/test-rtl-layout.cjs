const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const flatten = value => Array.isArray(value)
    ? Object.assign({}, ...value.map(flatten)) : value || {};

function load(file, requireMock) {
    const output = ts.transpileModule(read(file), {
        compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const exports = {};
    vm.runInNewContext(output, { exports, require: requireMock });
    return exports;
}

for (const platform of ['ios', 'android']) {
    const { Typography, textUsesArabicScript } = load('constants/typography.ts', () => ({ Platform: { OS: platform } }));
    for (const language of ['en', 'ar']) {
        const { Text } = load('components/ui/Text.tsx', name => {
            if (name === 'react') return require('react');
            if (name === 'react-native') return { Text: 'Text', StyleSheet: { flatten } };
            if (name === '@/constants/typography') return { Typography, textUsesArabicScript };
            throw new Error(name);
        });
        const latin = Text({ children: 'Test', align: 'left', style: { fontSize: 14, lineHeight: 14 } });
        const latinStyle = flatten(latin.props.style);
        assert.ok(latin.props.className.includes('text-left'));
        assert.equal(latinStyle.lineHeight, 14);
        assert.equal(latinStyle.fontFamily, Typography.font.body.regular);
        const arabic = Text({ children: 'اختبار', style: { fontSize: 14, lineHeight: 14 } });
        const arabicStyle = flatten(arabic.props.style);
        assert.equal(arabicStyle.lineHeight, 23);
        assert.equal(arabicStyle.fontFamily, Typography.font.arabic.regular);
        const roomy = Text({ children: 'اختبار', style: { fontSize: 14, lineHeight: 40 } });
        assert.equal(flatten(roomy.props.style).lineHeight, 40);
    }
}

assert.match(read('components/profile/UserProfileView.tsx'), /lightboxCarousel:.*direction: 'ltr'/);
assert.match(read('app/(onboarding)/index.tsx'), /useState\(isRTL \? 2 : 0\)/);
assert.match(read('app/(onboarding)/index.tsx'), /horizontal\s+style=\{\{ direction: 'ltr' \}\}/);
for (const file of ['components/ui/Checkbox.tsx', 'components/settings/SettingsFieldSection.tsx', 'app/(tabs)/(main)/(profile)/memberships.tsx']) {
    assert.ok(!read(file).includes("isRTL ? 'row-reverse' : 'row'"), file);
}
console.log('RTL layout checks passed: iOS/Android script-aware fonts, Arabic line height, carousel direction, onboarding and row mirroring.');
