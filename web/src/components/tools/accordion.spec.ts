import { describe, expect, it } from 'vitest'
import { defaultExpandedReaderId, nextExpandedId } from './accordion'

describe('nextExpandedId', () => {
  it('opens a closed panel', () => {
    expect(nextExpandedId(null, 'miniflux')).toBe('miniflux')
  })

  it('collapses the open panel when toggled again', () => {
    expect(nextExpandedId('miniflux', 'miniflux')).toBe(null)
  })

  it('switches exclusivity to the other panel', () => {
    expect(nextExpandedId('miniflux', 'freshrss')).toBe('freshrss')
  })
})

describe('defaultExpandedReaderId', () => {
  it('prefers miniflux when connected', () => {
    expect(defaultExpandedReaderId({ miniflux: true, freshrss: true })).toBe(
      'miniflux',
    )
  })

  it('uses freshrss when only freshrss is connected', () => {
    expect(defaultExpandedReaderId({ freshrss: true })).toBe('freshrss')
  })

  it('starts collapsed when nothing is connected', () => {
    expect(defaultExpandedReaderId({})).toBe(null)
  })
})
