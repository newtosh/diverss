import { beforeEach, describe, expect, it } from 'vitest'
import {
  blankFilterPack,
  deleteLocalFilterPack,
  exportLocalFilterPacksJson,
  importLocalFilterPacksJson,
  LOCAL_FILTER_PACKS_KEY,
  loadLocalFilterPacks,
  saveLocalFilterPack,
} from './localStore'

function installMemoryStorage() {
  const map = new Map<string, string>()
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v))
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  })
}

describe('local filter pack store', () => {
  beforeEach(() => {
    installMemoryStorage()
    localStorage.removeItem(LOCAL_FILTER_PACKS_KEY)
  })

  it('saves, loads, and deletes packs', () => {
    const pack = blankFilterPack('local-a')
    pack.name = 'Mine'
    pack.pattern = 'spam'
    saveLocalFilterPack(pack)
    expect(loadLocalFilterPacks()).toHaveLength(1)
    expect(loadLocalFilterPacks()[0]?.name).toBe('Mine')
    deleteLocalFilterPack('local-a')
    expect(loadLocalFilterPacks()).toHaveLength(0)
  })

  it('exports and imports JSON backup', () => {
    const pack = blankFilterPack('local-b')
    pack.pattern = 'clickbait'
    saveLocalFilterPack(pack)
    const json = exportLocalFilterPacksJson()
    localStorage.removeItem(LOCAL_FILTER_PACKS_KEY)
    const { imported } = importLocalFilterPacksJson(json)
    expect(imported).toBe(1)
    expect(loadLocalFilterPacks()[0]?.id).toBe('local-b')
  })
})
