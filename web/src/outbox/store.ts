import type { OutboxDestination, OutboxEntry } from './types'

const STORAGE_KEY = 'diverss-outbox-v1'

function isDestination(v: unknown): v is OutboxDestination {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  if (d.kind === 'ungrouped') return true
  if (d.kind === 'new' && typeof d.label === 'string') return true
  if (
    d.kind === 'existing' &&
    typeof d.label === 'string' &&
    Array.isArray(d.path) &&
    d.path.every((n) => typeof n === 'number')
  ) {
    return true
  }
  return false
}

function isOutboxEntry(v: unknown): v is OutboxEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.xmlUrl === 'string' &&
    typeof e.title === 'string' &&
    Array.isArray(e.groups) &&
    e.groups.every((g) => typeof g === 'string') &&
    isDestination(e.destination) &&
    typeof e.alreadyInWorkspace === 'boolean' &&
    typeof e.stagedAt === 'number'
  )
}

function readStoredEntries(): OutboxEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOutboxEntry)
  } catch {
    return []
  }
}

function writeStoredEntries(next: OutboxEntry[]): void {
  try {
    if (next.length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota — keep in-memory only */
  }
}

let entries: OutboxEntry[] = readStoredEntries()
let drawerOpen = false
const listeners = new Set<() => void>()

function emit(): void {
  writeStoredEntries(entries)
  for (const listener of listeners) listener()
}

export function getOutboxEntries(): readonly OutboxEntry[] {
  return entries
}

export function isOutboxDrawerOpen(): boolean {
  return drawerOpen
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function isStaged(xmlUrl: string): boolean {
  return entries.some((e) => e.xmlUrl === xmlUrl)
}

export function stageEntry(entry: Omit<OutboxEntry, 'id' | 'stagedAt'>): void {
  const existing = entries.findIndex((e) => e.xmlUrl === entry.xmlUrl)
  const next: OutboxEntry = {
    ...entry,
    id: existing >= 0 ? entries[existing]!.id : crypto.randomUUID(),
    stagedAt: Date.now(),
  }
  if (existing >= 0) {
    entries = entries.map((e, i) => (i === existing ? next : e))
  } else {
    entries = [...entries, next]
  }
  emit()
}

export function unstageByUrl(xmlUrl: string): void {
  const next = entries.filter((e) => e.xmlUrl !== xmlUrl)
  if (next.length === entries.length) return
  entries = next
  emit()
}

export function toggleStage(entry: Omit<OutboxEntry, 'id' | 'stagedAt'>): void {
  if (isStaged(entry.xmlUrl)) {
    unstageByUrl(entry.xmlUrl)
    return
  }
  stageEntry(entry)
}

export function updateEntry(
  id: string,
  patch: Partial<Pick<OutboxEntry, 'title' | 'destination' | 'alreadyInWorkspace'>>,
): void {
  const idx = entries.findIndex((e) => e.id === id)
  if (idx < 0) return
  entries = entries.map((e, i) => (i === idx ? { ...e, ...patch } : e))
  emit()
}

/** Remap every entry that currently shares `fromKey` to `destination`. */
export function remapGroup(
  fromKey: string,
  destination: OutboxEntry['destination'],
  keyOf: (d: OutboxEntry['destination']) => string,
): void {
  let changed = false
  entries = entries.map((e) => {
    if (keyOf(e.destination) !== fromKey) return e
    changed = true
    return { ...e, destination }
  })
  if (changed) emit()
}

export function removeEntry(id: string): void {
  const next = entries.filter((e) => e.id !== id)
  if (next.length === entries.length) return
  entries = next
  emit()
}

export function clearOutbox(): void {
  if (entries.length === 0 && !drawerOpen) return
  entries = []
  drawerOpen = false
  emit()
}

export function removeEntriesByIds(ids: string[]): void {
  if (ids.length === 0) return
  const drop = new Set(ids)
  const next = entries.filter((e) => !drop.has(e.id))
  if (next.length === entries.length) return
  entries = next
  emit()
}

export function setOutboxDrawerOpen(open: boolean): void {
  if (drawerOpen === open) return
  drawerOpen = open
  emit()
}

export function toggleOutboxDrawer(): void {
  drawerOpen = !drawerOpen
  emit()
}

/** Test helper — reset module state between specs. */
export function __resetOutboxForTests(): void {
  entries = []
  drawerOpen = false
  listeners.clear()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
