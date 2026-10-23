const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const source = fs.readFileSync(path.join(__dirname, '../components/profile/EditProfileMediaEditor.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const descendants = node => Array.isArray(node) ? node.flatMap(descendants)
    : node && typeof node === 'object' ? [node, ...descendants(node.props?.children)] : [];
const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const asset = { uri: 'file:///chosen.jpg', width: 1200, height: 1600, fileSize: 1000 };

async function setup(variant, overrides = {}) {
    const hooks = [];
    const effects = [];
    let cursor = 0;
    let dirty = false;
    let mounted = true;
    let tree;
    const state = {
        calls: [], toasts: [], uploads: [], galleryChanges: [], busyChanges: [], updatesAfterUnmount: [],
        gallery: [0, 1, 2].map(index => ({ uuid: `photo-${index}`, sort_index: index, isPrimary: index === 0, safe: true, url: `https://example.invalid/${index}.jpg` })),
        library: async () => ({ canceled: true }),
        camera: async () => ({ canceled: true }),
        permission: async () => ({ status: 'granted' }),
        ...overrides,
    };
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
    const mockReact = {
        ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
            return [hooks[index], value => {
                if (!mounted) { state.updatesAfterUnmount.push(index); return; }
                const next = typeof value === 'function' ? value(hooks[index]) : value;
                if (!Object.is(next, hooks[index])) { hooks[index] = next; dirty = true; }
            }];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = { current: initial };
            return hooks[index];
        },
        useMemo(factory, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) hooks[index] = { deps, value: factory() };
            return hooks[index].value;
        },
        useCallback(callback, deps) { return mockReact.useMemo(() => callback, deps); },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) effects.push(() => {
                hooks[index]?.cleanup?.();
                hooks[index] = { deps, cleanup: effect() };
            });
        },
    };
    const queryClient = { invalidateQueries: async () => {}, setQueryData() {} };
    const toast = (...args) => state.toasts.push(args);
    const palette = {
        brand: { bg: { border: 'border', surface: 'surface' }, text: { subtitle: 'subtitle' }, accent: { error: 'error' } },
        chrome: { primary: 'primary', common: { card: 'card', textMuted: 'muted' }, toast: { warning: { background: 'warning', text: 'warning-text', icon: 'warning-icon' } } },
    };
    const galleryService = {
        fetchMe: async () => ({ success: true, gallery: state.gallery, privacy: 'public' }),
        upload: async formData => {
            state.uploads.push(formData);
            const replaceUuid = formData.get('replaceUuid');
            state.gallery = state.gallery.map(item => item.uuid === replaceUuid ? { ...item, uuid: 'uploaded-photo' } : item);
            return { success: true, image: { uuid: 'uploaded-photo' } };
        },
    };
    const context = {
        exports: {},
        // No timeout should be needed to sequence native picker presentation.
        setTimeout() { assert.fail('Picker presentation must wait for onDismiss, not a timer'); },
        FormData: class {
            fields = new Map();
            append(key, value) { this.fields.set(key, value); }
            get(key) { return this.fields.get(key); }
        },
        require(name) {
            if (name === 'react') return mockReact;
            if (name === 'react/jsx-runtime') return require(name);
            if (name === 'react-native') return { View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', Platform: { OS: state.os || 'ios' }, StyleSheet: { create: value => value, absoluteFill: {} } };
            if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: { getItem: async () => '1', setItem: async () => {} } };
            if (name === 'expo-image') return { Image: 'Image' };
            if (name === 'expo-image-picker') return {
                requestMediaLibraryPermissionsAsync() { assert.fail('System gallery picker must not request library permission'); },
                requestCameraPermissionsAsync: async () => { state.calls.push('camera-permission'); return state.permission(); },
                launchCameraAsync: async options => { state.calls.push(['camera', options]); return state.camera(); },
                launchImageLibraryAsync: async options => { state.calls.push(['gallery', options]); return state.library(); },
            };
            if (name === '@tanstack/react-query') return { useQuery: () => ({ data: undefined }), useQueryClient: () => queryClient };
            if (name === '@/hooks/useTheme') return { useTheme: () => ({ isDark: false }) };
            if (name === '@/hooks/useColors') return { useColors: () => palette };
            if (name === '@/hooks/useLanguage') return { useLanguage: () => ({ currentLanguage: 'en', isRTL: false }) };
            if (name === '@/hooks/useToast') return { useToast: () => ({ show: toast }) };
            if (name === '@/hooks/useGalleryModeration') return { isGalleryModerationActive: () => false };
            if (name === '@/hooks/useResponsive') return { scale: value => value };
            if (name === '@/hooks/useCurrentUserStatus') return { CURRENT_USER_STATUS_QUERY_KEY: ['users', 'me'] };
            if (name === '@/lib/queryKeys') return { queryKeys: { gallery: { me: ['gallery', 'me'] } } };
            if (name === '@/lib/galleryService') return { galleryService };
            if (name === '@/lib/galleryQualification') return { hasQualifiedGalleryImage: items => items.length > 0, isQualifiedGalleryImage: () => true };
            if (name === '@/lib/profileDisplay') return { t: key => key, apiMessage: key => key };
            if (name === '@/lib/textDirection') return { localeUsesLatinScript: () => true };
            if (name === '@/constants/typography') return { Typography: { font: { body: { semi: 'semi', bold: 'bold', regular: 'regular' } } } };
            if (name === '@/components/ui/AmberCard') return { AmberCard: 'AmberCard', useAmberCardPalette: () => ({}) };
            if (name === '@/components/ui/icons/PhosphorCompat') return Object.fromEntries(['AlertCircle', 'ImagePlus', 'Info', 'Lock', 'Star', 'Unlock'].map(icon => [icon, icon]));
            if (name.startsWith('@/components/')) { const component = name.split('/').at(-1); return { [component]: component }; }
            throw new Error(`Unexpected import: ${name}`);
        },
    };
    vm.runInNewContext(compiled, context, { filename: 'EditProfileMediaEditor.tsx' });
    const props = {
        variant, canUsePrivateGallery: false, autoShowGuidelines: false, initialGallery: state.gallery,
        onGalleryChange: value => state.galleryChanges.push(value), onBusyChange: value => state.busyChanges.push(value),
    };
    const render = () => {
        assert.ok(mounted, 'Do not render after unmount');
        let passes = 0;
        do {
            assert.ok(passes++ < 20, 'Effects must settle');
            dirty = false; cursor = 0;
            tree = context.exports.ProfileMediaEditor(props);
            while (effects.length) effects.shift()();
        } while (dirty);
        return tree;
    };
    const settle = async () => {
        for (let index = 0; index < 3; index++) {
            await new Promise(setImmediate);
            if (mounted && dirty) render();
        }
    };
    const find = type => descendants(tree).find(node => node.type === type);
    const slot = index => descendants(tree).find(node => node.type === 'Pressable' && node.key === `photo-${index}`);
    render(); await settle();
    const choose = (index, source) => {
        const target = slot(index);
        assert.ok(target, `Slot ${index} exists`);
        assert.equal(Boolean(target.props.disabled), false);
        target.props.onPress(); render();
        const sheet = find('SingleSelectSheet');
        assert.equal(sheet.props.visible, true);
        sheet.props.onSelect(source); render();
        assert.equal(find('SingleSelectSheet').props.visible, false);
        return sheet;
    };
    return {
        state, find, slot, render, settle, choose,
        dismiss: () => { const sheet = find('SingleSelectSheet'); assert.equal(typeof sheet.props.onDismiss, 'function'); return sheet.props.onDismiss(); },
        unmount() { mounted = false; for (const hook of hooks) hook?.cleanup?.(); },
    };
}

for (const variant of ['edit-profile', 'onboarding']) {
    test(`${variant}/web: gallery launches directly in the selection gesture and ignores later dismissal`, async () => {
        const result = deferred();
        const f = await setup(variant, { os: 'web', library: () => result.promise });
        f.choose(2, 'gallery');
        assert.equal(f.state.calls.length, 1, 'Web picker must launch synchronously before the selection gesture returns');
        assert.equal(f.state.calls[0][0], 'gallery');
        f.dismiss(); f.dismiss(); await f.settle();
        assert.equal(f.state.calls.length, 1);
        result.resolve({ canceled: false, assets: [asset] }); await f.settle();
        assert.equal(f.find('GalleryCropModal').props.imageUri, asset.uri);
        await f.find('GalleryCropModal').props.onUpload('file:///web-cropped.jpg'); await f.settle();
        assert.equal(f.state.uploads[0].get('replaceUuid'), 'photo-2');
    });

    test(`${variant}: gallery waits for sheet dismissal, launches once without permission and preserves selected slot`, async () => {
        const result = deferred();
        const f = await setup(variant, { library: () => result.promise });
        const oldSheet = f.choose(2, 'gallery');
        assert.equal(f.state.calls.length, 0);
        oldSheet.props.onSelect('camera');
        f.dismiss(); f.dismiss();
        await f.settle();
        assert.equal(f.state.calls.length, 1);
        assert.equal(f.state.calls[0][0], 'gallery');
        assert.equal(f.state.calls[0][1].allowsMultipleSelection, false);
        assert.equal(f.state.busyChanges.at(-1), true);
        for (let index = 0; index < 3; index++) assert.equal(f.slot(index).props.disabled, true);
        result.resolve({ canceled: false, assets: [asset] }); await f.settle();
        const crop = f.find('GalleryCropModal');
        assert.equal(crop.props.visible, true);
        assert.equal(crop.props.imageUri, asset.uri);
        await crop.props.onUpload('file:///cropped.jpg'); await f.settle();
        assert.equal(f.state.uploads.length, 1);
        assert.equal(f.state.uploads[0].get('replaceUuid'), 'photo-2');
    });

    test(`${variant}: slots are disabled as soon as picker selection is queued, before dismissal`, async () => {
        const f = await setup(variant);
        f.choose(2, 'gallery');
        assert.equal(f.state.calls.length, 0);
        for (let index = 0; index < 3; index++) assert.equal(f.slot(index).props.disabled, true);
        assert.equal(f.state.busyChanges.at(-1), true);
    });

    test(`${variant}: camera permission is requested only after dismissal and precedes launch`, async () => {
        const permission = deferred();
        const f = await setup(variant, { permission: () => permission.promise, camera: async () => ({ canceled: false, assets: [asset] }) });
        f.choose(1, 'camera');
        assert.equal(f.state.calls.length, 0);
        f.dismiss(); f.dismiss(); await f.settle();
        assert.deepEqual(f.state.calls, ['camera-permission']);
        permission.resolve({ status: 'granted' }); await f.settle();
        assert.equal(f.state.calls.length, 2);
        assert.equal(f.state.calls[1][0], 'camera');
        assert.equal(f.find('GalleryCropModal').props.imageUri, asset.uri);
    });

    test(`${variant}: source-sheet cancellation does not launch a picker`, async () => {
        const f = await setup(variant);
        f.slot(0).props.onPress(); f.render();
        f.find('SingleSelectSheet').props.onClose(); f.render();
        f.dismiss(); f.dismiss(); await f.settle();
        assert.deepEqual(f.state.calls, []);
        assert.deepEqual(f.state.toasts, []);
        assert.equal(f.slot(0).props.disabled, false);
    });

    for (const source of ['gallery', 'camera']) {
        test(`${variant}/${source}: native cancel is quiet and a fresh attempt can launch`, async () => {
            const f = await setup(variant);
            f.choose(0, source); f.dismiss(); await f.settle();
            assert.equal(f.find('GalleryCropModal').props.visible, false);
            assert.deepEqual(f.state.toasts, []);
            assert.equal(f.slot(0).props.disabled, false);
            f.choose(1, source); f.dismiss(); await f.settle();
            assert.equal(f.state.calls.filter(call => Array.isArray(call) && call[0] === source).length, 2);
        });

        test(`${variant}/${source}: native failure reports existing error copy and unlocks retry`, async () => {
            const f = await setup(variant, { [source === 'gallery' ? 'library' : 'camera']: async () => { throw new Error('Native picker unavailable'); } });
            f.choose(0, source); f.dismiss(); await f.settle();
            assert.equal(f.state.toasts.length, 1);
            assert.equal(f.state.toasts[0][0], 'something_went_wrong');
            assert.equal(f.state.toasts[0][1], 'error');
            assert.equal(f.slot(0).props.disabled, false);
            assert.equal(f.find('GalleryCropModal').props.visible, false);
            f.state[source === 'gallery' ? 'library' : 'camera'] = async () => ({ canceled: true });
            f.choose(1, source); f.dismiss(); await f.settle();
            assert.equal(f.state.toasts.length, 1);
        });

        test(`${variant}/${source}: late picker success after unmount cannot crop, toast or update state`, async () => {
            const result = deferred();
            const f = await setup(variant, { [source === 'gallery' ? 'library' : 'camera']: () => result.promise });
            f.choose(0, source); f.dismiss(); await f.settle();
            const changes = f.state.galleryChanges.length;
            f.unmount(); result.resolve({ canceled: false, assets: [asset] }); await f.settle();
            assert.equal(f.state.galleryChanges.length, changes);
            assert.deepEqual(f.state.toasts, []);
            assert.deepEqual(f.state.updatesAfterUnmount, []);
            assert.equal(f.state.uploads.length, 0);
        });
    }

    test(`${variant}: camera permission denial is reported without launching`, async () => {
        const f = await setup(variant, { permission: async () => ({ status: 'denied' }) });
        f.choose(0, 'camera'); f.dismiss(); await f.settle();
        assert.deepEqual(f.state.calls, ['camera-permission']);
        assert.equal(f.state.toasts[0][0], 'camera_permission_required');
        assert.equal(f.slot(0).props.disabled, false);
    });

    test(`${variant}: unmount during camera permission wait suppresses launch and updates`, async () => {
        const permission = deferred();
        const f = await setup(variant, { permission: () => permission.promise });
        f.choose(0, 'camera'); f.dismiss(); await f.settle();
        f.unmount(); permission.resolve({ status: 'granted' }); await f.settle();
        assert.deepEqual(f.state.calls, ['camera-permission']);
        assert.deepEqual(f.state.toasts, []);
        assert.deepEqual(f.state.updatesAfterUnmount, []);
    });

    test(`${variant}: unmount before source dismissal discards the queued picker`, async () => {
        const f = await setup(variant);
        f.choose(0, 'gallery');
        const dismiss = f.find('SingleSelectSheet').props.onDismiss;
        assert.equal(typeof dismiss, 'function');
        f.unmount(); dismiss(); await f.settle();
        assert.deepEqual(f.state.calls, []);
        assert.deepEqual(f.state.updatesAfterUnmount, []);
    });
}
