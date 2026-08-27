import { validateFilterPack, validateManifest } from './schema'
import type { FilterPack } from './types'

function dataUrl(name: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}data/${name}`
}

export async function loadFilterPacks(
  fetchImpl: typeof fetch = fetch,
): Promise<FilterPack[]> {
  const indexRes = await fetchImpl(dataUrl('filter-packs/index.json'))
  if (!indexRes.ok) {
    throw new Error(`Filter pack index HTTP ${indexRes.status}`)
  }
  const manifest = validateManifest(await indexRes.json())
  const packs: FilterPack[] = []
  for (const id of manifest.packs) {
    const res = await fetchImpl(dataUrl(`filter-packs/${id}.json`))
    if (!res.ok) {
      throw new Error(`Filter pack ${id} HTTP ${res.status}`)
    }
    const pack = validateFilterPack(await res.json())
    if (pack.id !== id) {
      throw new Error(`Filter pack id mismatch: file ${id} vs ${pack.id}`)
    }
    packs.push(pack)
  }
  return packs
}
