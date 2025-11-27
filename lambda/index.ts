import { Hono, type Context } from 'hono'
import { streamHandle } from 'hono/aws-lambda'
// import { fetchUpstream } from '../src/upstream'
import { applyQuarantine } from '../src/quarantine'
import { isNpmPackageMeta } from '../src/validate'
import type { NpmPackageMeta } from '../src/types/npm'

const app = new Hono()
const UPSTREAM_REGISTRY = process.env.UPSTREAM_REGISTRY ?? 'https://registry.npmjs.org'
const QUARANTINE_DAYS = Number(process.env.QUARANTINE_DAYS ?? 7) // 既定の隔離日数

// 内部的には「分」を最小単位として扱い、最後に日数へ変換して隔離判定する
async function handleProxy(c: Context, overrideMinutes?: number) {
  const incoming = new URL(c.req.url)
  const pathname = incoming.pathname
  const upstreamURL = new URL(pathname, UPSTREAM_REGISTRY)
  if (incoming.search) upstreamURL.search = incoming.search

  const upstreamRes = await fetch(upstreamURL, { method: 'GET' })
  const contentType = upstreamRes.headers.get('content-type') ?? undefined
  if (!upstreamRes.ok) return c.newResponse(upstreamRes.body, upstreamRes)

  const isTarball = pathname.endsWith('.tgz')
  if (contentType?.includes('application/json')) {
    const raw = await upstreamRes.json()
    // overrideMinutes があれば日数換算。なければ既定 QUARANTINE_DAYS
    const effectiveDays = overrideMinutes !== undefined
      ? overrideMinutes / 1440 /* 60*24 */
      : QUARANTINE_DAYS
    if (!isNpmPackageMeta(raw)) return c.json(raw)
    const data: NpmPackageMeta = raw
    applyQuarantine(data['dist-tags'], data.time, new Date(), effectiveDays)
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' })
    return c.newResponse(JSON.stringify(data), { headers })
  }
  // 非JSON（主に .tgz）: 長めキャッシュ。その他はそのまま
  if (isTarball) {
    const headers = new Headers(upstreamRes.headers)
    headers.set('cache-control', 'public, max-age=86400, immutable')
    return c.newResponse(upstreamRes.body, { headers })
  }
  return c.newResponse(upstreamRes.body, { headers: upstreamRes.headers })
}

// d/h/m ルートを設定するための共通化
type OverrideConfig = {
  unit: 'd' | 'h' | 'm'
  paramName: 'days' | 'hours' | 'minutes'
  pattern: string // Hono route pattern
  toMinutes: (raw: number) => number // clamp + 既定値フォールバック後の分
}

const baseMinutesDefault = QUARANTINE_DAYS * 1440

const overrideConfigs: OverrideConfig[] = [
  {
    unit: 'd',
    paramName: 'days',
    pattern: '/d/:days/*',
    toMinutes: (raw) => {
      if (!Number.isFinite(raw)) return baseMinutesDefault
      const clamped = Math.min(365, Math.max(0, raw))
      return clamped * 1440
    },
  },
  {
    unit: 'h',
    paramName: 'hours',
    pattern: '/h/:hours/*',
    toMinutes: (raw) => {
      if (!Number.isFinite(raw)) return baseMinutesDefault
      const clamped = Math.min(365 * 24, Math.max(0, raw))
      return clamped * 60
    },
  },
  {
    unit: 'm',
    paramName: 'minutes',
    pattern: '/m/:minutes/*',
    toMinutes: (raw) => {
      if (!Number.isFinite(raw)) return baseMinutesDefault
      const clamped = Math.min(365 * 24 * 60, Math.max(0, raw))
      return clamped // そのまま分
    },
  },
]

overrideConfigs.forEach((cfg) => {
  app.get(cfg.pattern, async (c: Context) => {
    const rawStr = c.req.param(cfg.paramName)
    const rawNum = Number(rawStr)
    const overrideMinutes = cfg.toMinutes(rawNum)
    const fullPath = c.req.path
    const prefix = `/${cfg.unit}/${rawStr}`
    const remainder = fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) || '/' : '/'
    const url = new URL(c.req.url)
    url.pathname = remainder
    return handleProxy({ ...c, req: { ...c.req, url: url.toString() } } as Context, overrideMinutes)
  })
})

// 既定（オーバーライド無し）
app.get('/*', (c: Context) => handleProxy(c))

export const handler: import('aws-lambda').Handler = streamHandle(app)
