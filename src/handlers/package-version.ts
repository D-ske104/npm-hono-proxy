import type { Context } from 'hono'
import { fetchUpstream } from '../upstream'
import { isNpmPackageMeta } from '../validate'
import { findQuarantinedVersion } from '../quarantine'
import { emitLog } from '../utils/log'
import { getUpstreamBase } from '../utils/upstream'
import type { AppConfig } from '../config'

export async function handlePackageVersion(c: Context, config: AppConfig, safeMinutes: number) {
  const { pkg, version } = c.req.param()
  const upstreamBase = getUpstreamBase(config.logLevel, config.logFormat)
  const { res } = await fetchUpstream(`/${pkg}`, upstreamBase)
  if (!res.ok) return c.newResponse(res.body, res)

  const data = await res.json()
  if (isNpmPackageMeta(data) && config.quarantineEnabled) {
    const refNow = new Date()
    const { quarantined, latestSafeVersion } = findQuarantinedVersion(
      version,
      data.time,
      refNow,
      safeMinutes
    )
    if (quarantined) {
      emitLog(config.logLevel, config.logFormat, 'warn', 'quarantine-hit', {
        path: c.req.path,
        version,
        latestSafe: latestSafeVersion ?? 'n/a',
      })
      return c.json(
        {
          error: 'Version Not Found due to Quarantine Policy',
          message: `Version '${pkg}@${version}' is currently under quarantine.`,
          policy: {
            thresholdMinutes: safeMinutes,
          },
          latestSafeVersion: latestSafeVersion,
        },
        404
      )
    } else {
      // 隔離対象でなければ、通常通り上流のレスポンスを返す
      const { res: verRes } = await fetchUpstream(c.req.path, upstreamBase)
      return c.newResponse(verRes.body, verRes)
    }
  } else {
    // isNpmPackageMetaがfalse、またはquarantineが無効な場合
    const { res: verRes } = await fetchUpstream(c.req.path, upstreamBase)
    return c.newResponse(verRes.body, verRes)
  }
}
