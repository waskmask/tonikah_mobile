const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const locales = ['ar', 'de', 'en', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr'];
function load(file, resolve) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const context = { exports: {}, require: resolve, URL };
    vm.runInNewContext(ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText, context, { filename: file });
    return context.exports;
}

function setup(options = {}) {
    const state = { os: 'ios', version: '1.2.3', nativeVersion: '1.0.0', origin: 'https://dev.tonikah.com',
        result: 'opened', supported: true, calls: [], ...options };
    const helper = load('lib/webFeedback.ts', name => {
        if (name === 'react-native') return { Platform: { OS: state.os }, Linking: {
            canOpenURL: async url => { state.calls.push(['canOpen', url]); return state.supported; },
            openURL: async url => { state.calls.push(['link', url]); if (state.linkError) throw new Error('link'); },
        } };
        if (name === 'expo-constants') return { expoConfig: { version: state.version } };
        if (name === 'expo-application') return { nativeApplicationVersion: state.nativeVersion };
        if (name === '@/constants/config') return { Config: { WEB_APP_ORIGIN: state.origin } };
        if (name === 'expo-web-browser') return { openBrowserAsync: async url => {
            state.calls.push(['browser', url]);
            if (state.browserError) throw new Error('browser');
            return { type: state.result };
        } };
        throw new Error('Unexpected import: ' + name);
    });
    return { ...helper, state };
}

test('all supported locales and dev/prod origins use only allowlisted metadata', () => {
    for (const origin of ['https://dev.tonikah.com/', 'https://tonikah.com']) {
        for (const locale of locales) for (const os of ['ios', 'android', 'web']) {
            const f = setup({ origin, os });
            const url = new URL(f.getWebFeedbackUrl(locale));
            assert.equal(url.origin, new URL(origin).origin);
            assert.equal(url.pathname, `/${locale}/feedback`);
            assert.deepEqual([...url.searchParams], [['platform', os], ['appVersion', '1.2.3']]);
            assert.equal(url.hash, '');
            assert.equal(url.username + url.password, '');
        }
    }
});

test('untrusted locales, configured query, and invalid versions cannot leak into the URL', () => {
    for (const locale of ['en-US', '', '../support', 'ar?token=secret', 'email@example.com', '__proto__']) {
        const f = setup({ origin: 'https://tonikah.com/?token=secret#email@example.com',
            version: '1.2.3&token=secret', nativeVersion: null, os: 'windows' });
        assert.equal(f.getWebFeedbackUrl(locale), 'https://tonikah.com/en/feedback');
    }
    for (const version of [null, '', 'user@example.com', '1.2.3/' + 'a'.repeat(80)]) {
        const f = setup({ version, nativeVersion: '2.3.4-beta.1' });
        assert.equal(new URL(f.getWebFeedbackUrl('en')).searchParams.get('appVersion'), '2.3.4-beta.1');
    }
});

test('appVersion accepts 40 characters and rejects 41 for both version sources', () => {
    const maximum = '1.2.3-' + 'a'.repeat(34);
    const oversized = maximum + 'a';
    assert.equal(maximum.length, 40);
    assert.equal(oversized.length, 41);
    for (const options of [{ version: maximum }, { version: null, nativeVersion: maximum }]) {
        const f = setup(options);
        assert.equal(new URL(f.getWebFeedbackUrl('en')).searchParams.get('appVersion'), maximum);
    }
    const fallback = setup({ version: oversized, nativeVersion: maximum });
    assert.equal(new URL(fallback.getWebFeedbackUrl('en')).searchParams.get('appVersion'), maximum);
    for (const options of [
        { version: oversized, nativeVersion: null },
        { version: null, nativeVersion: oversized },
        { version: oversized, nativeVersion: oversized },
    ]) {
        const f = setup(options);
        assert.equal(new URL(f.getWebFeedbackUrl('en')).searchParams.has('appVersion'), false);
    }
});

test('normal browser dismissal never launches a second browser', async () => {
    for (const result of ['opened', 'cancel', 'dismiss']) {
        const f = setup({ result });
        await f.openWebFeedback('ar');
        assert.deepEqual(f.state.calls.map(call => call[0]), ['browser']);
    }
});

test('browser failure/lock uses supported default browser with the exact same private URL', async () => {
    for (const options of [{ browserError: true }, { result: 'locked' }]) {
        const f = setup(options);
        await f.openWebFeedback('de');
        assert.deepEqual(f.state.calls.map(call => call[0]), ['browser', 'canOpen', 'link']);
        assert.equal(new Set(f.state.calls.map(call => call[1])).size, 1);
    }
});

test('unsupported or failing fallback rejects so the hook can show an error toast', async () => {
    for (const options of [{ supported: false }, { linkError: true }]) {
        const f = setup({ browserError: true, ...options });
        await assert.rejects(f.openWebFeedback('en'));
    }
});

test('hook uses current language and translated error toast without throwing', async () => {
    const calls = [];
    const hook = load('hooks/useWebFeedback.ts', name => {
        if (name === 'react') return { useCallback: callback => callback };
        if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ currentLanguage: 'ar', t: key => key }) };
        if (name === '@/hooks/useToast') return { useToast: () => ({ show: (...args) => calls.push(args) }) };
        if (name === '@/lib/webFeedback') return { openWebFeedback: async locale => {
            calls.push(locale); throw new Error('unavailable');
        } };
        throw new Error(name);
    });
    await hook.useWebFeedback()();
    assert.deepEqual(calls, ['ar', ['feedback_open_failed', 'error']]);
});

test('all 11 locale dictionaries contain translated menu and error strings', () => {
    for (const locale of locales) {
        const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'locales', locale, 'common.json'), 'utf8'));
        for (const key of ['send_feedback', 'feedback_open_failed']) {
            assert.equal(typeof dictionary[key], 'string');
            assert.ok(dictionary[key].trim(), `${locale}: ${key}`);
        }
    }
});

// Reuse the existing drawer fixture without registering its separate regression suite.
const fixtureSource = fs.readFileSync(path.join(__dirname, 'test-app-menu-navigation.cjs'), 'utf8');
const fixture = { exports: {}, require, __dirname };
vm.runInNewContext(fixtureSource.slice(0, fixtureSource.indexOf("\nfor (const os of")) + '\nexports.setup = setup;', fixture);
const setupDrawer = fixture.exports.setup;
for (const os of ['ios', 'android']) {
    test(`${os}: Send Feedback remains adjacent to support and runs once after actual drawer close`, () => {
        const drawer = setupDrawer(undefined, undefined, { os });
        drawer.open();
        const content = setupDrawer('components/app/AppMenuDrawer.tsx', 'AppMenuDrawerContent', {
            props: { onCloseThenRun: drawer.content().props.onCloseThenRun },
        });
        const rows = content.nodes().filter(node => typeof node.type === 'function' && node.type.name === 'MenuRow');
        const index = rows.findIndex(row => row.props.label === 'send_feedback');
        assert.ok(index > 0);
        assert.equal(rows[index - 1].props.label, 'report_issue');
        rows[index].props.onPress();
        rows[index].props.onPress();
        drawer.render();
        assert.equal(drawer.modal().props.visible, false);
        assert.equal(content.state.calls.length, 0);
        if (os === 'ios') { drawer.flushFrames(); assert.equal(content.state.calls.length, 0); }
        drawer.finishClose(); drawer.finishClose();
        assert.deepEqual([...content.state.calls], ['feedback']);
        assert.equal(content.state.routes.length, 0);
    });
}
