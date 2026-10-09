const assert = require('node:assert/strict');
const test = require('node:test');
const limitMetroCache = require('./limit-metro-cache.cjs');

test('limits combined cache reads/writes and preserves results and clear', async () => {
  let active = 0;
  let peak = 0;
  let cleared = false;
  const store = {
    async get(key) {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return key;
    },
    set(key, value) { return this.get(value); },
    clear() { cleared = true; },
  };
  const [cache] = limitMetroCache([store], 4);
  const results = await Promise.all(Array.from({ length: 200 }, (_, i) =>
    i % 2 ? cache.get(i) : cache.set('key', i)));
  assert.equal(peak, 4);
  assert.deepEqual(results, Array.from({ length: 200 }, (_, i) => i));
  cache.clear();
  assert.equal(cleared, true);
});

test('releases queued operations after a cache error', async () => {
  const error = new Error('read failed');
  const [cache] = limitMetroCache([{
    get(key) { if (key === 'bad') throw error; return null; },
  }], 1);
  const failed = assert.rejects(cache.get('bad'), error);
  assert.equal(await cache.get('missing'), null);
  await failed;
});
