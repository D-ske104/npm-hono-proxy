import { serve } from '@hono/node-server'
import type { QuarantineNoSafePolicy } from './quarantine'
import { getArg, parseBool, ensureNonNegativeInt } from './utils/args'
import type { LogLevel, LogFormat } from './utils/log'
import { createApp } from './app'

const PORT = Number(getArg('port') ?? process.env.PORT ?? '4873')
const QUARANTINE_ENABLED = parseBool(getArg('quarantine-enabled') ?? process.env.QUARANTINE_ENABLED, true)
// 隔離期間を分単位で受け取り、内部では日数に換算して利用する
const rawQuarantineMinutes = Number(
  getArg('quarantine-minutes') ??
    process.env.QUARANTINE_MINUTES ??
    // 既定 21 日分の分: 21 * 24 * 60
    String(21 * 24 * 60)
)
const QUARANTINE_MINUTES = ensureNonNegativeInt(rawQuarantineMinutes)
if (QUARANTINE_MINUTES !== rawQuarantineMinutes) {
  console.warn(
    `⚠️  QUARANTINE_MINUTES (${rawQuarantineMinutes}) が不正値のため 0 に補正されました (隔離無効扱い)`
  )
}
const QUARANTINE_POLICY_ON_NO_SAFE = (getArg('quarantine-policy-on-no-safe') ?? process.env.QUARANTINE_POLICY_ON_NO_SAFE ?? 'set-safe') as QuarantineNoSafePolicy
const VERBOSE = parseBool(getArg('verbose') ?? process.env.VERBOSE, false)
const LOG_LEVEL = (getArg('log-level') ?? process.env.LOG_LEVEL ?? (VERBOSE ? 'info' : 'warn')).toLowerCase() as LogLevel
const LOG_FORMAT = (getArg('log-format') ?? process.env.LOG_FORMAT ?? 'text').toLowerCase() as LogFormat

const app = createApp({
  quarantineEnabled: QUARANTINE_ENABLED,
  quarantineMinutes: QUARANTINE_MINUTES,
  quarantinePolicyOnNoSafe: QUARANTINE_POLICY_ON_NO_SAFE,
  logLevel: LOG_LEVEL,
  logFormat: LOG_FORMAT,
})

console.info(`🛡️  Safe NPM Proxy running on http://localhost:${PORT}`)
console.info(
  `    quarantine: enabled=${QUARANTINE_ENABLED}, minutes=${QUARANTINE_MINUTES}, whenNoSafe=${QUARANTINE_POLICY_ON_NO_SAFE}`
)
console.info(`    logging: level=${LOG_LEVEL}, format=${LOG_FORMAT}${VERBOSE ? ', verbose=on' : ''}`)

serve({
  fetch: app.fetch,
  port: PORT,
})
