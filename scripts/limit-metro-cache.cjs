// Metro's dependency traversal reads the cache independently of maxWorkers.
module.exports = function limitMetroCache(stores, concurrency = 16) {
  let active = 0;
  const waiting = [];

  async function run(operation) {
    if (active >= concurrency) {
      await new Promise((resolve) => waiting.push(resolve));
    } else {
      active += 1;
    }
    try {
      return await operation();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  }

  return stores.map((store) => ({
    name: store.name ?? store.constructor.name,
    get: (key) => run(() => store.get(key)),
    set: (key, value) => run(() => store.set(key, value)),
    clear: () => store.clear(),
  }));
};
