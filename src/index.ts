import { Hono } from "hono";
import { serve } from '@hono/node-server'
import { fetchUpstream } from './upstream'
import { isNpmPackageMeta } from './validate'
import type { QuarantineNoSafePolicy } from './quarantine'
import { applyPolicy } from './utils/policy'
import { getArg, parseBool } from './utils/args'
import { emitLog } from './utils/log'
import type { LogLevel, LogFormat } from './utils/log'
import { getUpstreamBase } from './utils/upstream'
import { isJsonResponse, handleRedirect } from './utils/router'

const app = new Hono()

const PORT = Number(getArg('port') ?? process.env.PORT ?? '4873')
const QUARANTINE_ENABLED = parseBool(getArg('quarantine-enabled') ?? process.env.QUARANTINE_ENABLED, true)
const QUARANTINE_DAYS = Number(getArg('quarantine-days') ?? process.env.QUARANTINE_DAYS ?? '21')
const QUARANTINE_POLICY_ON_NO_SAFE = (getArg('quarantine-policy-on-no-safe') ?? process.env.QUARANTINE_POLICY_ON_NO_SAFE ?? 'set-safe') as QuarantineNoSafePolicy
const VERBOSE = parseBool(getArg('verbose') ?? process.env.VERBOSE, false)
const LOG_LEVEL = (getArg('log-level') ?? process.env.LOG_LEVEL ?? (VERBOSE ? 'info' : 'warn')).toLowerCase() as LogLevel
const LOG_FORMAT = (getArg('log-format') ?? process.env.LOG_FORMAT ?? 'text').toLowerCase() as LogFormat

app.get("/*", async (c) => {
  const path = c.req.path
  const upstreamBase = getUpstreamBase()

  // 本家へリクエスト
  const { res, contentType } = await fetchUpstream(path, upstreamBase)
  if (!res.ok) return c.newResponse(res.body, res)

  // JSON以外（.tgzなど）のリクエストは本家へリダイレクト
  if (!isJsonResponse(contentType)) {
    return handleRedirect(c, path, res.url, LOG_LEVEL, LOG_FORMAT)
  }

  // ここから下は JSON (メタデータ) の処理
  const data = await res.json()

  // 期待するNPMメタデータかを検証
  if (isNpmPackageMeta(data) && QUARANTINE_ENABLED) {
    // 隔離ポリシーの適用（メタデータのみを書き換え）
    const beforeLatest = data['dist-tags']?.['quarantine-latest']
    const result = applyPolicy(data, new Date(), QUARANTINE_DAYS, QUARANTINE_POLICY_ON_NO_SAFE)
    const afterLatest = data['dist-tags']?.['latest']
    emitLog(LOG_LEVEL, LOG_FORMAT, 'info', 'quarantine', {
      path,
      before: beforeLatest ?? 'n/a',
      after: afterLatest ?? 'n/a',
      days: QUARANTINE_DAYS,
      policy: QUARANTINE_POLICY_ON_NO_SAFE,
    })
    if (result.blocked) {
      emitLog(LOG_LEVEL, LOG_FORMAT, 'warn', 'blocked', { path, reason: result.reason ?? 'no-safe-versions', days: QUARANTINE_DAYS })
      return c.text('Quarantine policy blocked: no safe versions', 409)
    }
  }

  return c.json(data)
});

console.info(`🛡️  Safe NPM Proxy running on http://localhost:${PORT}`)
console.info(
  `    quarantine: enabled=${QUARANTINE_ENABLED}, days=${QUARANTINE_DAYS}, whenNoSafe=${QUARANTINE_POLICY_ON_NO_SAFE}`
)
console.info(`    logging: level=${LOG_LEVEL}, format=${LOG_FORMAT}${VERBOSE ? ', verbose=on' : ''}`)

serve({
  fetch: app.fetch,
  port: PORT,
})
