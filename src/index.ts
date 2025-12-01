import { Hono } from "hono";
import { serve } from '@hono/node-server'
import { fetchUpstream } from './upstream'
import { isNpmPackageMeta } from './validate'
import { applyQuarantine } from './quarantine'
import type { QuarantineNoSafePolicy } from './quarantine'

const app = new Hono()

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(prefix)) return a.slice(prefix.length)
  }
  return undefined
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback
  const t = v.toLowerCase()
  if (["1", "true", "yes", "on"].includes(t)) return true
  if (["0", "false", "no", "off"].includes(t)) return false
  return fallback
}

const PORT = Number(getArg('port') ?? process.env.PORT ?? '4873')
const QUARANTINE_ENABLED = parseBool(getArg('quarantine-enabled') ?? process.env.QUARANTINE_ENABLED, true)
const QUARANTINE_DAYS = Number(getArg('quarantine-days') ?? process.env.QUARANTINE_DAYS ?? '21')
const QUARANTINE_POLICY_ON_NO_SAFE = (getArg('quarantine-policy-on-no-safe') ?? process.env.QUARANTINE_POLICY_ON_NO_SAFE ?? 'set-safe') as QuarantineNoSafePolicy

app.get("/*", async (c) => {
  const path = c.req.path

  // 本家へリクエスト
  const { res, contentType } = await fetchUpstream(path)
  if (!res.ok) return c.newResponse(res.body, res)

  // JSON以外（.tgzなど）のリクエストは本家へリダイレクト
  if (!contentType?.includes("application/json")) {
    return c.redirect(res.url, 302)
  }

  // ここから下は JSON (メタデータ) の処理
  const data = await res.json()

  // 期待するNPMメタデータかを検証
  if (isNpmPackageMeta(data) && QUARANTINE_ENABLED) {
    // 隔離ポリシーの適用（メタデータのみを書き換え）
    try {
      applyQuarantine(
      data["dist-tags"],
      data.time,
      new Date(),
      QUARANTINE_DAYS,
      QUARANTINE_POLICY_ON_NO_SAFE,
      )
    } catch (e) {
      // ポリシー 'fail' の場合は 409 を返してインストールを明示的に止める
      return c.text('Quarantine policy blocked: no safe versions', 409)
    }
  }

  return c.json(data)
});

console.info(`🛡️  Safe NPM Proxy running on http://localhost:${PORT}`)
console.info(
  `    quarantine: enabled=${QUARANTINE_ENABLED}, days=${QUARANTINE_DAYS}, whenNoSafe=${QUARANTINE_POLICY_ON_NO_SAFE}`
)

serve({
  fetch: app.fetch,
  port: PORT,
})
