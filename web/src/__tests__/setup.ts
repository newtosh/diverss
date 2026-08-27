import 'fake-indexeddb/auto'

/**
 * Node 22+ may expose an experimental, unusable global `localStorage`
 * (`--localstorage-file` required), which shadows jsdom's Storage and breaks
 * specs that call `localStorage.*` at module scope / beforeEach.
 */
function installMemoryLocalStorage(): void {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage,
      configurable: true,
    })
  }
}

try {
  // Accessing length or removeItem can throw / be undefined under Node webstorage.
  if (
    typeof localStorage === 'undefined' ||
    typeof localStorage.removeItem !== 'function'
  ) {
    installMemoryLocalStorage()
  } else {
    localStorage.setItem('__gardenrss_storage_probe__', '1')
    localStorage.removeItem('__gardenrss_storage_probe__')
  }
} catch {
  installMemoryLocalStorage()
}
