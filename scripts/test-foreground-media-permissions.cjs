const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const base = require('../app.json').expo;
const makeConfig = require('../app.config');
const config = makeConfig({ config: base });
const source = fs.readFileSync(path.join(root, 'app/conversation/[id].tsx'), 'utf8');
const tree = ts.createSourceFile('conversation.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const blocked = [
    'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MICROPHONE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_MEDIA_VISUAL_USER_SELECTED',
];

function appStateCallback(marker) {
    let result;
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(tree) === 'AppState.addEventListener'
            && node.arguments[1]?.getText(tree).includes(marker)) result = node.arguments[1].getText(tree);
        ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.ok(result, `AppState callback exists: ${marker}`);
    return result;
}

test('audio remains enabled for foreground use only', () => {
    const audio = config.plugins.filter((p) => (Array.isArray(p) ? p[0] : p) === 'expo-audio');
    assert.equal(audio.length, 1);
    assert.equal(audio[0][1].recordAudioAndroid, true);
    assert.equal(audio[0][1].enableBackgroundPlayback, false);
    assert.equal(audio[0][1].enableBackgroundRecording, false);
    assert.equal(config.plugins.find((p) => Array.isArray(p) && p[0] === 'react-native-waveform-recorder')[1].backgroundRecording, false);
    assert.match(source, /backgroundRecording=\{false\}/);
});

test('permission exclusions preserve existing Android configuration', () => {
    const customized = makeConfig({ config: { ...base, android: { ...base.android, blockedPermissions: ['android.permission.READ_CONTACTS'] } } });
    for (const permission of blocked) assert.ok(customized.android.blockedPermissions.includes(`android.permission.${permission}`));
    assert.ok(customized.android.blockedPermissions.includes('android.permission.READ_CONTACTS'));
    assert.equal(customized.android.package, base.android.package);
    assert.ok(!customized.android.blockedPermissions.includes('android.permission.CAMERA'));
    assert.ok(!customized.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
});

test('generated native configuration retains camera/microphone and removes background services', () => {
    const generated = JSON.parse(execFileSync(process.execPath, [
        path.join(root, 'node_modules/expo/bin/cli'), 'config', '--type', 'introspect', '--json',
    ], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000 }));
    const manifest = generated._internal.modResults.android.manifest.manifest;
    const permissions = manifest['uses-permission'];
    for (const permission of blocked) {
        const entries = permissions.filter((p) => p.$['android:name'] === `android.permission.${permission}`);
        assert.ok(entries.length > 0, `${permission} has a manifest-merger removal directive`);
        assert.ok(entries.every((p) => p.$['tools:node'] === 'remove'), `${permission} cannot be merged from dependencies`);
    }
    for (const permission of ['CAMERA', 'RECORD_AUDIO']) {
        assert.ok(permissions.some((p) => p.$['android:name'] === `android.permission.${permission}` && p.$['tools:node'] !== 'remove'));
    }
    const services = manifest.application[0].service || [];
    assert.ok(!services.some((s) => /AudioControlsService|AudioRecordingService|WaveformRecorderBackgroundService/.test(s.$['android:name'])));
    const plist = generated._internal.modResults.ios.infoPlist;
    assert.ok(!(plist.UIBackgroundModes || []).includes('audio'));
    assert.ok(plist.NSMicrophoneUsageDescription);
});

test('chat playback stops on background/inactive and does not restart on return', () => {
    let stopped = 0;
    let marked = 0;
    const callback = vm.runInNewContext(`(${appStateCallback('stopAllChatAudioPlayback')})`, {
        stopAllChatAudioPlayback: () => stopped++,
        requestAnimationFrame: (cb) => cb(),
        tryMarkVisibleUnreadRef: { current: () => marked++ },
    });
    callback('inactive');
    callback('background');
    callback('active');
    assert.equal(stopped, 2);
    assert.equal(marked, 1);
});

test('recording pauses when leaving the app and returns to preview instead of resuming capture', () => {
    let paused = 0;
    let previewed = 0;
    const stateRef = { current: 'recording' };
    const callback = vm.runInNewContext(`(${appStateCallback("stateRef.current === 'recording'")})`, {
        stateRef, previewRequestedRef: { current: false },
        recorderRef: { current: { pause: () => paused++, enterPreview: () => previewed++ } },
    });
    callback('background');
    assert.equal(paused, 1);
    stateRef.current = 'paused';
    callback('active');
    assert.equal(previewed, 1);
});

test('photo flows retain system selection and camera capture without requesting library-wide access', () => {
    for (const file of ['app/conversation/[id].tsx', 'components/profile/EditProfileMediaEditor.tsx', 'components/profile/ReportSheet.tsx']) {
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        assert.match(text, /ImagePicker\.launchImageLibraryAsync/);
        assert.doesNotMatch(text, /requestMediaLibraryPermissionsAsync|legacy:\s*true/);
    }
    assert.match(source, /ImagePicker\.requestCameraPermissionsAsync/);
    assert.match(source, /ImagePicker\.launchCameraAsync/);
});
