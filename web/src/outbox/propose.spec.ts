import { describe, expect, it } from 'vitest'
import { parseOpml } from '@/opml/parse'
import {
  categoryPresence,
  proposeDestination,
  workspaceMembershipKeys,
  isUrlInWorkspace,
} from './propose'

const sample = `<?xml version="1.0"?>
<opml version="2.0"><head><title>x</title></head><body>
  <outline text="Apple">
    <outline text="MacRumors" xmlUrl="https://macrumors.com/feed" />
  </outline>
  <outline text="Outer"><outline text="Inner">
    <outline text="F" xmlUrl="https://f.example/feed" />
  </outline></outline>
</body></opml>`

describe('proposeDestination', () => {
  it('returns ungrouped when groups are empty', () => {
    const doc = parseOpml(sample)
    expect(proposeDestination([], doc)).toEqual({ kind: 'ungrouped' })
    expect(categoryPresence({ kind: 'ungrouped' })).toBe('ungrouped')
  })

  it('matches an existing workspace category by full label', () => {
    const doc = parseOpml(sample)
    const dest = proposeDestination(['Apple'], doc)
    expect(dest).toEqual({
      kind: 'existing',
      path: [0],
      label: 'Apple',
    })
    expect(categoryPresence(dest)).toBe('existing')
  })

  it('matches nested labels case-insensitively', () => {
    const doc = parseOpml(sample)
    expect(proposeDestination(['outer', 'inner'], doc)).toEqual({
      kind: 'existing',
      path: [1, 0],
      label: 'Outer › Inner',
    })
  })

  it('proposes a new category when nothing matches', () => {
    const doc = parseOpml(sample)
    const dest = proposeDestination(['Cyber security'], doc)
    expect(dest).toEqual({ kind: 'new', label: 'Cyber security' })
    expect(categoryPresence(dest)).toBe('new')
  })

  it('joins nested groups into a › path for new categories', () => {
    const doc = parseOpml(sample)
    expect(proposeDestination(['A', 'B'], doc)).toEqual({
      kind: 'new',
      label: 'A › B',
    })
  })

  it('uses a unique leaf match when the full path differs', () => {
    const doc = parseOpml(sample)
    expect(proposeDestination(['Something', 'Apple'], doc)).toEqual({
      kind: 'existing',
      path: [0],
      label: 'Apple',
    })
  })
})

describe('workspace membership', () => {
  it('detects URLs already in the workspace', () => {
    const doc = parseOpml(sample)
    const keys = workspaceMembershipKeys(doc)
    expect(isUrlInWorkspace('https://macrumors.com/feed', keys)).toBe(true)
    expect(isUrlInWorkspace('https://other.example/feed', keys)).toBe(false)
  })
})
