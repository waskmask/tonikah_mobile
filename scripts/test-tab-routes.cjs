const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getRoutes } = require('expo-router/build/getRoutesCore');

const app = path.join(__dirname, '../app');
function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(directory, entry.name);
        return entry.isDirectory() ? files(full) : full.endsWith('.tsx') ? [full] : [];
    });
}
const keys = files(app).map((file) => `./${path.relative(app, file).replaceAll('\\', '/')}`);
const context = (key) => {
    const source = fs.readFileSync(path.join(app, key), 'utf8');
    const initialRouteName = source.match(/initialRouteName: '([^']+)'/)?.[1];
    return { default: () => null, unstable_settings: initialRouteName ? { initialRouteName } : undefined };
};
context.keys = () => keys;
const root = getRoutes(context, {
    platform: 'ios', skipGenerated: true, importMode: 'sync',
    getSystemRoute: () => { throw new Error('Unexpected generated route'); },
});
function child(node, route) {
    const found = node.children.find((item) => item.route === route);
    assert.ok(found, `Missing route ${route}`);
    return found;
}
const tabs = child(child(root, '(tabs)'), '(main)');
const profile = child(tabs, '(profile)');
const messages = child(tabs, '(messages)');
assert.equal(profile.initialRouteName, 'profile');
assert.equal(messages.initialRouteName, 'messages');
for (const route of ['profile', 'settings', 'settings-account', 'settings-security', 'settings-privacy',
    'settings-notifications', 'verifications', 'phone-verification', 'set-password', 'change-email',
    'delete-account', 'language', 'blocked-users', 'memberships', 'edit-profile']) {
    child(profile, route);
    assert.ok(!root.children.some((item) => item.route === route), `${route} must not cover native tabs`);
}
child(messages, 'messages');
assert.ok(!messages.children.some((item) => item.route === 'conversation/[id]'));
child(root, 'conversation/[id]');
child(root, 'user/[id]');
for (const route of ['partner-preference', 'hobbies-faith']) {
    child(root, route);
    assert.ok(!profile.children.some((item) => item.route === route), `${route} must open without tabs`);
}
child(root, '(auth)');
child(root, '(profile-setup)');
const sheet = fs.readFileSync(path.join(__dirname, '../components/profile/UserProfileSheet.tsx'), 'utf8');
assert.ok(sheet.includes('presentationStyle="fullScreen"'));
console.log('Expo route tree: settings retain native tabs; conversations, public profiles and auth remain outside.');
