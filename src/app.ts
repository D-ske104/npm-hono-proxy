import { Hono } from 'hono'
import { fetchUpstream } from './upstream'
import { isNpmPackageMeta } from './validate'
import { applyPolicy } from './utils/policy'
import { isJsonResponse, handleRedirect } from './utils/router'
import type { QuarantineNoSafePolicy } from './quarantine'
import type { LogLevel, LogFormat } from './utils/log'
import { emitLog } from './utils/log'
import { getUpstreamBase } from './utils/upstream'

export interface AppConfig {
  quarantineEnabled: boolean
  quarantineMinutes: number
  quarantinePolicyOnNoSafe: QuarantineNoSafePolicy
  logLevel: LogLevel
  logFormat: LogFormat
}

export function createApp(config: AppConfig) {
  // 下限バリデーション（負値や NaN を 0 に補正）
  const safeMinutes = (Number.isFinite(config.quarantineMinutes) && config.quarantineMinutes >= 0)
    ? Math.floor(config.quarantineMinutes)
    : 0
  const app = new Hono()
  app.get('/*', async (c) => {
    const path = c.req.path
    const upstreamBase = getUpstreamBase()
    const { res, contentType } = await fetchUpstream(path, upstreamBase)
    if (!res.ok) return c.newResponse(res.body, res)
    if (!isJsonResponse(contentType)) {
      return handleRedirect(c, path, res.url, config.logLevel, config.logFormat)
    }
    const data = await res.json()
    if (isNpmPackageMeta(data) && config.quarantineEnabled) {
      const beforeLatest = data['dist-tags']?.['quarantine-latest']
      const result = applyPolicy(
        data,
        new Date(),
        safeMinutes,
        config.quarantinePolicyOnNoSafe,
      )
      const afterLatest = data['dist-tags']?.['latest']
      emitLog(config.logLevel, config.logFormat, 'info', 'quarantine', {
        path,
        before: beforeLatest ?? 'n/a',
        after: afterLatest ?? 'n/a',
        minutes: safeMinutes,
        policy: config.quarantinePolicyOnNoSafe,
      })
      if (result.blocked) {
        emitLog(config.logLevel, config.logFormat, 'warn', 'blocked', {
          path,
          reason: result.reason ?? 'no-safe-versions',
          minutes: safeMinutes,
        })
        return c.text('Quarantine policy blocked: no safe versions', 409)
      }
    }
    return c.json(data)
  })
  return app
}
