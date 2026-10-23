const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(relative, globals = {}) {
    const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
    const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const context = { exports: {}, ...globals };
    vm.runInNewContext(compiled, context);
    return context.exports;
}

function config(env) {
    return load('constants/config.ts', { process: { env: { EXPO_PUBLIC_APP_ENV: env } } }).Config;
}

function setup(fetch) {
    return load('lib/connectivity.ts', {
        require: (name) => {
            assert.equal(name, '@/constants/config');
            return { Config: config('prod') };
        },
        fetch, AbortController, setTimeout, clearTimeout,
    }).connectivity;
}

test('EAS production profile selects the deployed API; dev and staging are unchanged', () => {
    const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '../eas.json'), 'utf8'));
    const production = config(eas.build.production.env.EXPO_PUBLIC_APP_ENV);
    assert.equal(production.API_URL, 'https://apis.tonikah.com/api');
    assert.equal(production.WEB_APP_ORIGIN, 'https://tonikah.com');
    for (const env of ['dev', 'staging', undefined]) {
        assert.equal(config(env).API_URL, 'https://devapi.tonikah.com/api');
    }
});

test('connectivity checks the public API endpoint, deduplicates checks, and recovers', async () => {
    let resolve;
    const calls = [];
    const connectivity = setup((url, options) => {
        calls.push({ url, options });
        return new Promise(done => { resolve = done; });
    });
    const first = connectivity.check();
    const second = connectivity.check();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://apis.tonikah.com/api/mobile-config');
    assert.equal(calls[0].options.cache, 'no-store');
    resolve({ ok: true });
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(connectivity.getSnapshot(), 'online');

    const failure = connectivity.check();
    resolve({ ok: false, status: 503 });
    assert.equal(await failure, false);
    assert.equal(connectivity.getSnapshot(), 'offline');

    const recovery = connectivity.check();
    resolve({ ok: true });
    assert.equal(await recovery, true);
    assert.equal(connectivity.getSnapshot(), 'online');
});

test('network errors, HTTP failures and timeouts do not report online', async () => {
    for (const status of [404, 429, 500]) {
        const connectivity = setup(async () => ({ ok: false, status }));
        assert.equal(await connectivity.check(), false);
        assert.equal(connectivity.getSnapshot(), 'offline');
    }
    const network = setup(async () => { throw new Error('Network request failed'); });
    assert.equal(await network.check(), false);

    const timeout = setup((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    assert.equal(await timeout.check(5), false);
    assert.equal(timeout.getSnapshot(), 'offline');
});
