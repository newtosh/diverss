#!/usr/bin/env node
/**
 * Local SPA + Score Worker with automatic free-port selection.
 *
 * Preferred ports: web 5173, worker 8787. On conflict, increments.
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findFreePort } from './lib/find-free-port.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const host = process.env.HOST || '127.0.0.1'

const webPreferred = Number(process.env.WEB_PORT) || 5173
const workerPreferred = Number(process.env.SCORE_PORT) || 8787

const workerPort = await findFreePort(workerPreferred, host)
const webPort = await findFreePort(webPreferred, host)

if (workerPort !== workerPreferred) {
  console.log(`[diverss] Score port ${workerPreferred} busy — using ${workerPort}`)
}
if (webPort !== webPreferred) {
  console.log(`[diverss] SPA port ${webPreferred} busy — using ${webPort}`)
}

/** @type {import('node:child_process').ChildProcess[]} */
const children = []

function run(cwd, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    shuttingDown = true
    for (const c of children) {
      if (c !== child && !c.killed) c.kill('SIGTERM')
    }
    if (signal) process.kill(process.pid, signal)
    process.exit(code ?? 1)
  })
  return child
}

let shuttingDown = false

run(join(root, 'workers/score'), 'npx', [
  'wrangler',
  'dev',
  '--ip',
  host,
  '--port',
  String(workerPort),
])

run(
  join(root, 'web'),
  'npm',
  ['run', 'dev:vite', '--', '--host', host, '--port', String(webPort)],
  { VITE_SCORE_URL: `http://${host}:${workerPort}` },
)

console.log('')
console.log(`[diverss] SPA          http://${host}:${webPort}/`)
console.log(`[diverss] Score API    http://${host}:${workerPort}/api/score`)
console.log('')

function shutdown(sig) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) {
    if (!c.killed) c.kill(sig)
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => shutdown(sig))
}
