import net from 'node:net'

/**
 * First free TCP port at or above `start` on `host`.
 * @param {number} start
 * @param {string} [host='127.0.0.1']
 * @param {number} [maxTries=50]
 * @returns {Promise<number>}
 */
export function findFreePort(start, host = '127.0.0.1', maxTries = 50) {
  if (!Number.isInteger(start) || start < 1 || start > 65535) {
    return Promise.reject(new Error(`invalid start port: ${start}`))
  }

  return new Promise((resolve, reject) => {
    let port = start
    let tries = 0

    const attempt = () => {
      if (tries >= maxTries || port > 65535) {
        reject(new Error(`no free port from ${start} after ${maxTries} tries`))
        return
      }
      tries += 1
      const server = net.createServer()
      server.unref()
      server.once('error', (err) => {
        if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EADDRINUSE') {
          port += 1
          attempt()
          return
        }
        reject(err)
      })
      server.listen(port, host, () => {
        const addr = server.address()
        const chosen =
          addr && typeof addr === 'object' ? addr.port : port
        server.close((closeErr) => {
          if (closeErr) reject(closeErr)
          else resolve(chosen)
        })
      })
    }

    attempt()
  })
}
