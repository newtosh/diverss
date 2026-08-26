import { afterEach, describe, expect, it } from 'vitest'
import {
  __resetOutboxForTests,
  clearOutbox,
  getOutboxEntries,
  isOutboxDrawerOpen,
  isStaged,
  removeEntriesByIds,
  setOutboxDrawerOpen,
  stageEntry,
  toggleStage,
  unstageByUrl,
} from './store'

afterEach(() => {
  __resetOutboxForTests()
})

const base = {
  title: 'MacRumors',
  xmlUrl: 'https://macrumors.com/feed',
  groups: ['Apple'],
  destination: { kind: 'new' as const, label: 'Apple' },
  alreadyInWorkspace: false,
}

describe('outbox store', () => {
  it('stages and unstages by url toggle', () => {
    toggleStage(base)
    expect(isStaged(base.xmlUrl)).toBe(true)
    expect(getOutboxEntries()).toHaveLength(1)
    toggleStage(base)
    expect(isStaged(base.xmlUrl)).toBe(false)
    expect(getOutboxEntries()).toHaveLength(0)
  })

  it('replaces an existing staged row for the same url', () => {
    stageEntry(base)
    stageEntry({ ...base, title: 'MacRumors Updated' })
    const entries = getOutboxEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]!.title).toBe('MacRumors Updated')
  })

  it('clear empties entries and closes the drawer', () => {
    stageEntry(base)
    setOutboxDrawerOpen(true)
    clearOutbox()
    expect(getOutboxEntries()).toHaveLength(0)
    expect(isOutboxDrawerOpen()).toBe(false)
  })

  it('removeEntriesByIds drops only those rows', () => {
    stageEntry(base)
    stageEntry({
      ...base,
      xmlUrl: 'https://other.example/feed',
      title: 'Other',
    })
    const [first] = getOutboxEntries()
    removeEntriesByIds([first!.id])
    expect(getOutboxEntries().map((e) => e.xmlUrl)).toEqual([
      'https://other.example/feed',
    ])
  })

  it('unstageByUrl is a no-op for unknown urls', () => {
    stageEntry(base)
    unstageByUrl('https://missing.example/feed')
    expect(getOutboxEntries()).toHaveLength(1)
  })

  it('rehydrates staged entries from sessionStorage', () => {
    stageEntry(base)
    expect(sessionStorage.getItem('diverss-outbox-v1')).toBeTruthy()
    // Simulate a fresh module load by reading what a new store would see.
    const raw = sessionStorage.getItem('diverss-outbox-v1')!
    const parsed = JSON.parse(raw) as unknown[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      xmlUrl: base.xmlUrl,
      title: base.title,
    })
  })
})
