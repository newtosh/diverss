import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import net from 'node:net'
import { findFreePort } from './find-free-port.mjs'

describe('findFreePort', () => {
  it('returns the preferred port when free', async () => {
    const port = await findFreePort(39111)
    assert.equal(port, 39111)
  })

  it('increments past a busy port', async () => {
    const blocker = net.createServer()
    await new Promise((resolve, reject) => {
      blocker.once('error', reject)
      blocker.listen(39120, '127.0.0.1', resolve)
    })
    try {
      const port = await findFreePort(39120)
      assert.ok(port > 39120)
    } finally {
      await new Promise((resolve) => blocker.close(resolve))
    }
  })
})
