import { describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app'
import type { AppConfig } from '../src/app'

function mockUpstream(json: any, contentType = 'application/json') {
  const res = new Response(JSON.stringify(json), { headers: { 'content-type': contentType } })
  return vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(res)
}

const baseConfig: AppConfig = {
  quarantineEnabled: true,
  quarantineMinutes: 60,
  quarantinePolicyOnNoSafe: 'set-safe',
  logLevel: 'silent',
  logFormat: 'text'
}

describe('integration: metadata quarantine flow', () => {
  it('rewrites latest when newest version is within quarantine minutes', async () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const time = {
      // 1.0.0 は 5000 分前 (閾値 60 分より十分古い = safe)
      '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(),
      // 2.0.0 は 30 分前 (閾値未満 = quarantine 対象)
      '2.0.0': new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    }
    const upstreamPayload = { 'dist-tags': { latest: '2.0.0' }, time }
    const spy = mockUpstream(upstreamPayload)
    const app = createApp(baseConfig)
    const res = await app.request('/pkg')
    const body = await res.json()
    expect(body['dist-tags'].latest).toBe('1.0.0')
    expect(body['dist-tags']['quarantine-latest']).toBe('2.0.0')
    spy.mockRestore()
  })

  it('returns 409 when policy fail and no safe versions', async () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const time = {
      // いずれも閾値 60 分未満なので safe が存在しないケース
      '1.0.0': new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      '1.1.0': new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    }
    const upstreamPayload = { 'dist-tags': { latest: '1.1.0' }, time }
    const spy = mockUpstream(upstreamPayload)
    const app = createApp({ ...baseConfig, quarantinePolicyOnNoSafe: 'fail' })
    const res = await app.request('/pkg')
    expect(res.status).toBe(409)
    const text = await res.text()
    expect(text).toContain('Quarantine policy blocked')
    spy.mockRestore()
  })

  it('redirects non-json content', async () => {
    const spy = mockUpstream('tarball-data', 'application/octet-stream')
    const app = createApp(baseConfig)
    const res = await app.request('/pkg/-/pkg-1.0.0.tgz')
    // Hono redirect returns 302
    expect(res.status).toBe(302)
    spy.mockRestore()
  })
})
