import { ref } from 'vue'
import Dexie, { type EntityTable } from 'dexie'
import type { OpmlDocument } from '@/opml/types'
import { emptyOpmlDocument } from '@/opml/types'
import type { ScoreResult, ScoreTimeframe } from '@/score/client'

/**
 * Bumps on every successful workspace write. KeepAlive'd views watch this to
 * adopt external updates (Outbox import, Catalog prune revert, etc.) without
 * Redux/Pinia — one document, many cached copies.
 */
export const workspaceEpoch = ref(0)

export const WORKSPACE_KEY = 'current' as const
export const LOCAL_BACKUP_KEY = 'gardenrss-workspace-v1'

export interface WorkspaceSnapshot {
  document: OpmlDocument
  scores: Record<string, ScoreResult>
  timeframe: ScoreTimeframe
  updatedAt: number
}

export interface WorkspaceRecord extends WorkspaceSnapshot {
  id: typeof WORKSPACE_KEY
}

class WorkspaceDatabase extends Dexie {
  workspace!: EntityTable<WorkspaceRecord, 'id'>

  constructor() {
    super('gardenrss-workspace')
    this.version(1).stores({
      workspace: 'id',
    })
    // v2 keeps the same primary key; new fields live on the record object.
    this.version(2).stores({
      workspace: 'id',
    })
  }
}

export const db = new WorkspaceDatabase()

function isOpmlDocument(v: unknown): v is OpmlDocument {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.title === 'string' && Array.isArray(o.outlines)
}

function normalizeSnapshot(raw: unknown): WorkspaceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const document = o.document
  if (!isOpmlDocument(document)) {
    // Legacy row: entire record was just { id, document, updatedAt } or document-shaped.
    if (isOpmlDocument(raw)) {
      return {
        document: raw,
        scores: {},
        timeframe: '7d',
        updatedAt: Date.now(),
      }
    }
    return null
  }
  const scores =
    o.scores && typeof o.scores === 'object' && !Array.isArray(o.scores)
      ? (o.scores as Record<string, ScoreResult>)
      : {}
  const timeframe =
    o.timeframe === '1d' || o.timeframe === '7d' || o.timeframe === '30d'
      ? o.timeframe
      : '7d'
  const updatedAt = typeof o.updatedAt === 'number' ? o.updatedAt : Date.now()
  return { document, scores, timeframe, updatedAt }
}

function readLocalBackup(): WorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(LOCAL_BACKUP_KEY)
    if (!raw) return null
    return normalizeSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeLocalBackup(snapshot: WorkspaceSnapshot): void {
  try {
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(snapshot))
  } catch {
    // Quota / private mode — IndexedDB may still succeed.
  }
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const empty: WorkspaceSnapshot = {
    document: emptyOpmlDocument(),
    scores: {},
    timeframe: '7d',
    updatedAt: 0,
  }

  let idb: WorkspaceSnapshot | null = null
  try {
    const row = await db.workspace.get(WORKSPACE_KEY)
    if (row) {
      idb = normalizeSnapshot(row)
      // Legacy v1 shape: { id, document, updatedAt }
      if (!idb && isOpmlDocument(row.document)) {
        idb = {
          document: row.document,
          scores: {},
          timeframe: '7d',
          updatedAt: row.updatedAt ?? Date.now(),
        }
      }
    }
  } catch {
    idb = null
  }

  const local = readLocalBackup()

  if (idb && local) {
    return idb.updatedAt >= local.updatedAt ? idb : local
  }
  return idb ?? local ?? empty
}

/** @deprecated Prefer loadWorkspaceSnapshot — kept for tests / simple callers. */
export async function loadWorkspace(): Promise<OpmlDocument> {
  const snap = await loadWorkspaceSnapshot()
  return snap.document
}

export async function saveWorkspaceSnapshot(
  snapshot: Omit<WorkspaceSnapshot, 'updatedAt'> & { updatedAt?: number },
): Promise<WorkspaceSnapshot> {
  const record: WorkspaceRecord = {
    id: WORKSPACE_KEY,
    document: snapshot.document,
    scores: snapshot.scores,
    timeframe: snapshot.timeframe,
    updatedAt: snapshot.updatedAt ?? Date.now(),
  }
  writeLocalBackup(record)
  try {
    await db.workspace.put(record)
  } catch {
    // localStorage backup already written
  }
  workspaceEpoch.value += 1
  return {
    document: record.document,
    scores: record.scores,
    timeframe: record.timeframe,
    updatedAt: record.updatedAt,
  }
}

export async function saveWorkspace(document: OpmlDocument): Promise<void> {
  const existing = await loadWorkspaceSnapshot()
  await saveWorkspaceSnapshot({
    document,
    scores: existing.scores,
    timeframe: existing.timeframe,
  })
}

export async function clearWorkspace(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_BACKUP_KEY)
  } catch {
    /* ignore */
  }
  await db.workspace.delete(WORKSPACE_KEY)
}
