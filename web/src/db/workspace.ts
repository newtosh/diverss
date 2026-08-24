import Dexie, { type EntityTable } from 'dexie'
import type { OpmlDocument } from '@/opml/types'
import { emptyOpmlDocument } from '@/opml/types'

export const WORKSPACE_KEY = 'current' as const

export interface WorkspaceRecord {
  id: typeof WORKSPACE_KEY
  document: OpmlDocument
  updatedAt: number
}

class WorkspaceDatabase extends Dexie {
  workspace!: EntityTable<WorkspaceRecord, 'id'>

  constructor() {
    super('diverss-workspace')
    this.version(1).stores({
      workspace: 'id',
    })
  }
}

export const db = new WorkspaceDatabase()

export async function loadWorkspace(): Promise<OpmlDocument> {
  const row = await db.workspace.get(WORKSPACE_KEY)
  return row?.document ?? emptyOpmlDocument()
}

export async function saveWorkspace(document: OpmlDocument): Promise<void> {
  await db.workspace.put({
    id: WORKSPACE_KEY,
    document,
    updatedAt: Date.now(),
  })
}

export async function clearWorkspace(): Promise<void> {
  await db.workspace.delete(WORKSPACE_KEY)
}
