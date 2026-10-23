const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const paletteModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'constants/Colors.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, paletteModule);
const palettes = paletteModule.exports.Colors;
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object'
    ? [node, ...nodes(node.props?.children)] : [];
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const consent = (allowed = null) => ({ allowed, version: null, currentVersion: '2026-10-22', decidedAt: null, requiresDecision: allowed === null });

test('privacy settings: current policy versions and accepted records remain separate', () => {
    const screen = fs.readFileSync(path.join(root, 'app/(tabs)/(main)/(profile)/settings-privacy.tsx'), 'utf8');
    assert.match(screen, /value=\{privacyConsent\?\.currentTermsVersion/);
    assert.match(screen, /value=\{privacyConsent\?\.currentPrivacyVersion/);
    assert.match(screen, /note=\{`\$\{t\('accepted_version', 'Accepted version'\)\}: \$\{privacyConsent\?\.termsVersion/);
    assert.match(screen, /note=\{`\$\{t\('accepted_version', 'Accepted version'\)\}: \$\{privacyConsent\?\.privacyVersion/);
    assert.match(screen, /formatSessionDate\(privacyConsent.consentAt, currentLanguage\)/);
    for (const locale of ['en', 'de', 'ar', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr']) {
        const messages = JSON.parse(fs.readFileSync(path.join(root, 'locales', locale, 'common.json'), 'utf8'));
        assert.ok(messages.accepted_version?.trim(), locale);
    }
});

function harness({ web = false, boundary = false, gate = false, setting = false, toggleRow = false, response, request, theme = 'light' } = {}) {
    const slots = [], effects = [], calls = [], saved = [], cached = [];
    let cursor = 0, dirty = false, tree, user = { _id: 'account-1' }, getImpl = response;
    const hooks = {
        ...React,
        useState(initial) {
            const i = cursor++;
            slots[i] ??= { value: typeof initial === 'function' ? initial() : initial };
            return [slots[i].value, update => { slots[i].value = typeof update === 'function' ? update(slots[i].value) : update; dirty = true; }];
        },
        useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
        useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
        useEffect(effect, deps) {
            const i = cursor++;
            if (!same(slots[i]?.deps, deps)) {
                const old = slots[i]; slots[i] = { deps };
                effects.push(() => { old?.cleanup?.(); slots[i].cleanup = effect(); });
            }
        },
    };
    const nativeResult = allowed => ({ success: true, consent: { aiModeration: consent(allowed) } });
    const patch = async (...args) => {
        calls.push(args);
        if (request) return request(...args);
        const allowed = web ? args[1].allowed : args[0];
        const result = nativeResult(allowed);
        return web ? { data: result } : result;
    };
    const get = async () => {
        const result = await (getImpl?.() ?? Promise.resolve(nativeResult(null)));
        return { data: result };
    };
    const file = toggleRow ? 'components/settings/SettingsRows.tsx' : web ? '../tonikah-frontend-next/components/app/AiModerationConsent.tsx' : gate ? 'components/app/LegalConsentGate.tsx' : 'components/app/AiModerationConsentChoice.tsx';
    const compiled = ts.transpileModule(fs.readFileSync(path.resolve(root, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const ctx = { exports: {}, require(name) {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return require(name);
        if (name === 'react-native') return { Text: 'Text', View: 'View', Switch: 'Switch', Modal: 'Modal', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', Linking: { openURL() {} }, StyleSheet: { create: v => v, hairlineWidth: 1 } };
        if (name === '@/components/ui/Text') return { Text: 'Text' };
        if (name === '@/components/ui/PressableScale') return { PressableScale: 'PressableScale' };
        if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ isRTL: false }) };
        if (name === '@/lib/accountService') return { accountService: { updateAiModerationConsent: patch, getPrivacyConsent: async () => (await get()).data, acceptLatestConsent: async () => nativeResult(null) } };
        if (name === '@/lib/apiClient') return { api: { get, patch } };
        if (name === '@/lib/queryClient') return { queryClient: { cancelQueries: async () => {}, setQueryData: (...args) => cached.push(args) } };
        if (name === '@/lib/queryKeys') return { queryKeys: { settings: { privacyConsent: ['settings', 'privacyConsent'] } } };
        if (name === 'next/link') return { __esModule: true, default: 'Link' };
        if (name === 'next-intl') return { useTranslations: () => key => key };
        if (name === '@radix-ui/react-dialog') return { Root: 'DialogRoot', Portal: 'DialogPortal', Overlay: 'DialogOverlay', Content: 'DialogContent', Title: 'DialogTitle', Close: 'DialogClose' };
        if (name === '@phosphor-icons/react/dist/ssr') return { Check: 'Check', CircleNotch: 'CircleNotch', ShieldCheck: 'ShieldCheck', X: 'X' };
        if (name === '@/constants/config') return { Config: { PRIVACY_URL: 'https://tonikah.com/privacy-policy' } };
        if (name === '@/store/authStore') { const store = selector => selector({ user, isAuthenticated: Boolean(user) }); store.getState = () => ({ user }); return { useAuthStore: store }; }
        if (name === '@/lib/profileDisplay') return { t: (_key, fallback) => fallback, apiMessage: key => key };
        if (name === '@/hooks/useResponsive') return { scale: value => value };
        if (name === '@/hooks/useToast') return { useToast: () => ({ show() {} }) };
        if (name === './AiModerationConsentChoice') return { AiModerationConsentChoice: 'AiModerationConsentChoice' };
        if (name === '@/components/ui/icons/PhosphorCompat') return { ShieldCheck: 'ShieldCheck' };
        if (name === 'phosphor-react-native') return { Check: 'Check', ShieldCheck: 'ShieldCheck', X: 'X' };
        if (name === '@/components/settings/SettingsRows') return { SettingsToggleRow: 'SettingsToggleRow' };
        if (name === '@/hooks/useColors') return { useColors: () => palettes[theme] };
        throw new Error(`Unexpected import ${name}`);
    } };
    vm.runInNewContext(compiled, ctx);
    const component = ctx.exports[toggleRow ? 'SettingsToggleRow' : boundary ? 'AiModerationConsentBoundary' : gate ? 'LegalConsentGate' : setting ? 'AiModerationConsentSetting' : 'AiModerationConsentChoice'];
    let props = toggleRow ? { label: 'AI checks', value: false, onValueChange() {} } : boundary ? { enabled: true, children: 'authenticated app' } : { consent: consent(), onSaved: value => saved.push(value) };
    const render = update => {
        props = { ...props, ...update };
        let loops = 0;
        do {
            dirty = false; cursor = 0; tree = component(props);
            while (effects.length) effects.shift()();
            if (++loops > 20) throw new Error('render loop');
        } while (dirty);
        return tree;
    };
    render();
    return {
        calls, saved, cached, render, get tree() { return tree; },
        buttons: () => nodes(tree).filter(n => n.type === (web ? 'button' : 'Pressable') && (web ? n.props.onClick : n.props.onPress) && n.props.accessibilityRole !== 'link'),
        async choose(allow) {
            const button = this.buttons()[allow ? 0 : 1];
            const callback = web ? button.props.onClick : button.props.onPress;
            callback(); render(); await this.flush();
        },
        async flush() { for (let i = 0; i < 8; i++) { await Promise.resolve(); render(); } },
        setUser: value => { user = value; },
        unmount: () => slots.forEach(slot => slot?.cleanup?.()),
    };
}

for (const theme of ['light', 'dark']) {
    test(`native ${theme}: saved choice is highlighted and AI recommendation uses themed amber colors`, () => {
        const h = harness({ theme });
        for (const allowed of [true, false, null]) {
            h.render({ consent: consent(allowed) });
            assert.equal(h.buttons()[0].props.accessibilityState.selected, allowed === true);
            assert.equal(h.buttons()[1].props.accessibilityState.selected, allowed === false);
            assert.equal(nodes(h.tree).filter(n => n.type === 'Check').length, allowed === null ? 0 : 1);
            const recommendation = nodes(h.buttons()[0]).find(n => n.props?.children === 'Recommended');
            assert.equal(Boolean(recommendation), allowed !== true);
            if (recommendation) assert.equal(recommendation.props.style.color, palettes[theme].chrome.toast.warning.text);
            assert.equal(nodes(h.buttons()[1]).some(n => n.props?.children === 'Recommended'), false);
            const pill = nodes(h.buttons()[0]).find(n => n.type === 'View' && Array.isArray(n.props.style) && n.props.style.some(s => s?.backgroundColor === palettes[theme].chrome.toast.warning.bg));
            assert.equal(Boolean(pill), allowed !== true);
            assert.equal(nodes(h.tree).some(n => typeof n.props?.children === 'string' && n.props.children.startsWith('Current choice:')), false);
            const heading = nodes(h.tree).find(n => n.props?.variant === 'h3');
            assert.equal(heading.props.style.color, palettes[theme].chrome.common.textStrong);
        }
        h.render({ settings: true });
        const dialog = nodes(h.tree).find(n => n.type === 'View' && Array.isArray(n.props.style) && n.props.style.some(s => s?.backgroundColor === palettes[theme].chrome.common.card));
        assert.ok(dialog);
    });
}

test('native settings: saved switch selection, two-line disclosure, and no duplicate heading', () => {
    const h = harness();
    h.render({ settings: true, consent: consent(true) });
    assert.equal(nodes(h.tree).filter(n => n.props?.variant === 'h3').length, 0);
    const row = () => nodes(h.tree).find(n => n.type === 'SettingsToggleRow');
    assert.equal(row().props.value, true);
    assert.equal(nodes(row().props.descriptionContent).some(n => n.props?.children === 'Recommended'), false);
    assert.ok(nodes(row().props.descriptionContent).some(n => n.props?.numberOfLines === 2));
    h.render({ consent: consent(false) });
    assert.equal(row().props.value, false);
    const descriptionNodes = nodes(row().props.descriptionContent);
    assert.ok(descriptionNodes.some(n => n.props?.children === 'Recommended'));
    assert.equal(descriptionNodes.some(n => typeof n.props?.children === 'string' && n.props.children.startsWith('Current choice:')), false);
    assert.equal(h.calls.length, 0);
});

test('native settings: enabling saves AI permission directly without opening the modal', async () => {
    const h = harness();
    h.render({ settings: true, consent: consent(false) });
    nodes(h.tree).find(n => n.type === 'SettingsToggleRow').props.onValueChange(true);
    await h.flush();
    assert.equal(nodes(h.tree).find(n => n.type === 'Modal').props.visible, false);
    assert.equal(h.saved[0].aiModeration.allowed, true);
    assert.equal(h.cached[0][1].aiModeration.allowed, true);
});

test('native settings: slow save shows busy switch area without claiming consent early', async () => {
    let finish;
    const h = harness({ request: () => new Promise(resolve => { finish = resolve; }) });
    h.render({ settings: true, consent: consent(false) });
    const row = () => nodes(h.tree).find(n => n.type === 'SettingsToggleRow');
    row().props.onValueChange(true); h.render();
    assert.equal(row().props.busy, true);
    assert.equal(row().props.disabled, true);
    assert.equal(row().props.value, false);
    assert.equal(h.saved.length, 0);
    finish({ success: true, consent: { aiModeration: consent(true) } });
    await h.flush();
    assert.equal(row().props.busy, false);
    assert.equal(row().props.disabled, false);
    assert.equal(h.saved[0].aiModeration.allowed, true);
});

test('native settings: failed save clears the loader and keeps the switch off', async () => {
    const h = harness({ request: async () => { throw new Error('offline'); } });
    h.render({ settings: true, consent: consent(false) });
    nodes(h.tree).find(n => n.type === 'SettingsToggleRow').props.onValueChange(true);
    await h.flush();
    const row = nodes(h.tree).find(n => n.type === 'SettingsToggleRow');
    assert.equal(row.props.busy, false);
    assert.equal(row.props.value, false);
    assert.equal(h.saved.length, 0);
});

test('shared toggle: busy spinner occupies the switch area without changing its layout', () => {
    const h = harness({ toggleRow: true });
    assert.equal(nodes(h.tree).filter(n => n.type === 'ActivityIndicator').length, 0);
    h.render({ busy: true });
    const toggle = nodes(h.tree).find(n => n.type === 'Switch');
    assert.equal(toggle.props.disabled, true);
    assert.equal(toggle.props.style.opacity, 0);
    assert.equal(toggle.props.accessibilityState.busy, true);
    assert.equal(nodes(h.tree).filter(n => n.type === 'ActivityIndicator').length, 1);
    h.render({ busy: false });
    assert.equal(nodes(h.tree).find(n => n.type === 'Switch').props.style.opacity, 1);
    assert.equal(nodes(h.tree).filter(n => n.type === 'ActivityIndicator').length, 0);
});

test('native settings: disabling confirms the actual saved AI choice before saving admin review', async () => {
    const h = harness();
    h.render({ settings: true, consent: consent(true) });
    nodes(h.tree).find(n => n.type === 'SettingsToggleRow').props.onValueChange(false);
    await h.flush();
    assert.equal(h.calls.length, 0);
    assert.equal(nodes(h.tree).find(n => n.type === 'SettingsToggleRow').props.value, true);
    assert.equal(nodes(h.tree).find(n => n.type === 'Modal').props.visible, true);
    const sharedChoice = nodes(h.tree).find(n => typeof n.type === 'function' && n.props?.recommendSelectedAi);
    assert.equal(sharedChoice.props.consent.allowed, true);
    const modal = harness();
    modal.render(sharedChoice.props);
    assert.equal(modal.buttons()[0].props.accessibilityState.selected, true);
    assert.ok(nodes(modal.buttons()[0]).some(n => n.props?.children === 'Recommended'));
    await modal.choose(false);
    h.render();
    assert.equal(h.saved[0].aiModeration.allowed, false);
    assert.equal(modal.cached[0][1].aiModeration.allowed, false);
    assert.equal(nodes(h.tree).find(n => n.type === 'Modal').props.visible, false);
});

test('native settings: canceling switch-off leaves permission unchanged', async () => {
    const h = harness();
    h.render({ settings: true, consent: consent(true) });
    nodes(h.tree).find(n => n.type === 'SettingsToggleRow').props.onValueChange(false);
    h.render();
    nodes(h.tree).find(n => n.type === 'Modal').props.onRequestClose();
    await h.flush();
    assert.equal(h.calls.length, 0);
    assert.equal(h.saved.length, 0);
    assert.equal(nodes(h.tree).find(n => n.type === 'SettingsToggleRow').props.value, true);
    assert.equal(nodes(h.tree).find(n => n.type === 'Modal').props.visible, false);
});

test('native: success without a confirmed saved choice is an error, not permission', async () => {
    const h = harness({ request: async () => ({ success: true, consent: { aiModeration: consent(null) } }) });
    await h.choose(true);
    assert.equal(h.saved.length, 0);
    assert.equal(h.cached.length, 0);
    assert.ok(nodes(h.tree).some(n => n.props?.accessibilityRole === 'alert'));
});

test('web settings: saved permission drives the switch and enabling saves directly', async () => {
    const h = harness({ web: true, setting: true });
    h.render({ consent: consent(false) });
    const toggle = () => nodes(h.tree).find(n => n.props?.role === 'switch');
    assert.equal(toggle().props['aria-checked'], false);
    toggle().props.onClick();
    await h.flush();
    assert.equal(h.saved[0].allowed, true);
    assert.equal(h.calls[0][1].allowed, true);
    h.render({ consent: h.saved[0] });
    assert.equal(toggle().props['aria-checked'], true);
});

test('web settings: disabling opens the shared modal with saved AI selection and recommendation', () => {
    const h = harness({ web: true, setting: true });
    h.render({ consent: consent(true) });
    nodes(h.tree).find(n => n.props?.role === 'switch').props.onClick();
    h.render();
    const dialog = nodes(h.tree).find(n => typeof n.type === 'function' && n.type.name === 'AiModerationConsentDialog');
    assert.equal(dialog.props.open, true);
    assert.equal(dialog.props.consent.allowed, true);
    assert.equal(dialog.props.recommendSelectedAi, true);
    assert.equal(h.calls.length, 0);
    dialog.props.onClose(); h.render();
    assert.equal(nodes(h.tree).find(n => n.props?.role === 'switch').props['aria-checked'], true);
    assert.equal(h.calls.length, 0);
});

test('web: stale or incomplete save response is not acknowledged as permission', async () => {
    const h = harness({ web: true, request: async () => ({ data: { success: true, consent: { aiModeration: consent(null) } } }) });
    await h.choose(true);
    assert.equal(h.saved.length, 0);
    assert.ok(nodes(h.tree).some(n => n.props?.role === 'alert'));
});

test('native startup choice updates the shared Settings cache after saving', async () => {
    const h = harness();
    await h.choose(true);
    assert.equal(h.cached.length, 1);
    assert.equal(h.cached[0][1].aiModeration.allowed, true);
});

for (const web of [false, true]) {
    const label = web ? 'web' : 'native';
    test(`${label}: permission and manual review are separate explicit commands, never preselected`, () => {
        const h = harness({ web });
        assert.equal(h.buttons().length, 2);
        assert.equal(h.calls.length, 0);
        assert.equal(h.saved.length, 0);
    });
    for (const allowed of [false, true]) test(`${label}: persists explicit ${allowed} choice with disclosure version`, async () => {
        const h = harness({ web });
        await h.choose(allowed);
        assert.equal(h.calls.length, 1);
        if (web) { assert.equal(h.calls[0][0], '/account/me/ai-moderation-consent'); assert.equal(h.calls[0][1].allowed, allowed); assert.equal(h.calls[0][1].version, '2026-10-22'); }
        else assert.deepEqual(h.calls[0], [allowed, '2026-10-22']);
        assert.equal(h.saved.length, 1);
        assert.equal((web ? h.saved[0] : h.saved[0].aiModeration).allowed, allowed);
    });
    test(`${label}: failure does not claim consent was saved`, async () => {
        const h = harness({ web, request: () => Promise.reject(new Error('offline')) });
        await h.choose(true);
        assert.equal(h.saved.length, 0);
        assert.ok(nodes(h.tree).some(n => n.props?.role === 'alert' || n.props?.accessibilityRole === 'alert'));
        assert.ok(h.buttons().every(n => !n.props.disabled));
    });
    test(`${label}: duplicate taps cannot race different permission choices`, async () => {
        let finish;
        const h = harness({ web, request: () => new Promise(resolve => { finish = resolve; }) });
        const original = h.buttons();
        (web ? original[0].props.onClick : original[0].props.onPress)();
        (web ? original[1].props.onClick : original[1].props.onPress)();
        h.render();
        assert.equal(h.calls.length, 1);
        assert.ok(h.buttons().every(n => n.props.disabled));
        const result = { success: true, consent: { aiModeration: consent(true) } };
        finish(web ? { data: result } : result);
        await h.flush();
        assert.equal(h.saved.length, 1);
    });
}

test('native: a late permission response cannot update another signed-in account', async () => {
    let finish;
    const h = harness({ request: () => new Promise(resolve => { finish = resolve; }) });
    h.buttons()[0].props.onPress();
    h.setUser({ _id: 'account-2' });
    finish({ success: true, consent: { aiModeration: consent(true) } });
    await h.flush();
    assert.equal(h.saved.length, 0);
});

test('web: undecided accounts see the choice before app content, then either decision resumes the app', async () => {
    const h = harness({ web: true, boundary: true });
    assert.notEqual(h.tree, 'authenticated app');
    await h.flush();
    const choice = nodes(h.tree).find(n => typeof n.type === 'function' && n.type.name === 'AiModerationConsentDialog');
    assert.ok(choice);
    assert.equal(choice.props.required, true);
    choice.props.onSaved(consent(false)); h.render();
    assert.equal(h.tree, 'authenticated app');
});

test('web: a recorded refusal is respected without repeatedly prompting', async () => {
    const h = harness({ web: true, boundary: true, response: async () => ({ success: true, consent: { aiModeration: consent(false) } }) });
    await h.flush(); assert.equal(h.tree, 'authenticated app');
});

test('consent disclosure and choices match across all 11 RN/web locales', () => {
    for (const locale of ['en', 'ar', 'de', 'es', 'fr', 'id', 'it', 'pl', 'pt', 'ru', 'tr']) {
        const native = JSON.parse(fs.readFileSync(path.join(root, 'locales', locale, 'common.json'), 'utf8'));
        const web = JSON.parse(fs.readFileSync(path.join(root, '../tonikah-frontend-next/locales', locale, 'common.json'), 'utf8'));
        for (const key of ['ai_review_title', 'ai_review_disclosure', 'ai_review_choice', 'ai_review_allow', 'ai_review_decline', 'ai_review_allowed', 'ai_review_manual', 'ai_review_save_error', 'membership_recommended']) {
            assert.ok(native[key]?.trim(), `${locale}/${key}`); assert.equal(native[key], web[key]);
        }
        assert.match(native.ai_review_disclosure, /OpenAI/); assert.match(native.ai_review_disclosure, /Google Gemini/);
    }
});

test('native: startup reserves the modal before any editor can open, then asks for AI permission', async () => {
    const h = harness({ gate: true });
    assert.ok(nodes(h.tree).some(n => n.type === 'Modal'));
    assert.ok(nodes(h.tree).some(n => n.type === 'ActivityIndicator'));
    await h.flush();
    assert.ok(nodes(h.tree).some(n => n.type === 'AiModerationConsentChoice'));
});

test('native: terms acceptance never implicitly grants AI permission', async () => {
    const h = harness({ gate: true, response: async () => ({ success: true, consent: { requiresReaccept: true, aiModeration: consent() } }) });
    await h.flush();
    assert.ok(!nodes(h.tree).some(n => n.type === 'AiModerationConsentChoice'));
    const agree = nodes(h.tree).find(n => n.props?.accessibilityRole === 'checkbox');
    agree.props.onPress(); h.render();
    nodes(h.tree).filter(n => n.type === 'Pressable').at(-1).props.onPress();
    await h.flush();
    assert.ok(nodes(h.tree).some(n => n.type === 'AiModerationConsentChoice'));
    assert.equal(h.calls.length, 0);
});

test('native: a recorded refusal does not prompt again after sign-in', async () => {
    const h = harness({ gate: true, response: async () => ({ success: true, consent: { requiresReaccept: false, aiModeration: consent(false) } }) });
    await h.flush(); assert.equal(h.tree, null);
});

test('native: a failed consent lookup releases loading and cannot grant permission', async () => {
    const h = harness({ gate: true, response: async () => { throw new Error('offline'); } });
    await h.flush(); assert.equal(h.tree, null); assert.equal(h.calls.length, 0);
});
