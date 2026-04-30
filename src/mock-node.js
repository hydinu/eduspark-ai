export const AsyncLocalStorage = class {
  getStore() { return undefined; }
  run(store, callback) { return callback(); }
};
