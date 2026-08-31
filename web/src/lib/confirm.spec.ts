import { describe, expect, it } from 'vitest'
import { confirm, resolveConfirm } from './confirm'

describe('confirm', () => {
  it('settles a still-open prior request as cancelled when superseded', async () => {
    const first = confirm('first?')
    const second = confirm('second?')

    resolveConfirm(true)

    expect(await first).toBe(false)
    expect(await second).toBe(true)
  })

  it('resolves normally when only one request is open', async () => {
    const result = confirm('only?')
    resolveConfirm(true)
    expect(await result).toBe(true)
  })
})
