import { describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app'
import type { AppConfig } from '../src/app'

function mockUpstream(json: any, contentType = 'application/json') {
  const res = new Response(JSON.stringify(json), { headers: { 'content-type': contentType } })
  return vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(res)
}

const base: Omit<AppConfig, 'quarantineMinutes'> = {
  quarantineEnabled: true,
  quarantinePolicyOnNoSafe: 'set-safe',
  logLevel: 'silent',
  logFormat: 'text'
}

describe('config: quarantineMinutes lower-bound validation', () => {
  it('treats negative minutes as 0 (no quarantine)', async () => {
    const now = new Date()
    const time = {
      // 10 分前のバージョン（通常なら threshold 60 未満で隔離対象）
      '1.0.0': new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    }
    const upstreamPayload = { 'dist-tags': { latest: '1.0.0' }, time }
    const spy = mockUpstream(upstreamPayload)
    const app = createApp({ ...base, quarantineMinutes: -5 })
    const res = await app.request('/pkg')
    const body = await res.json()
    expect(body['dist-tags'].latest).toBe('1.0.0')
    expect(body['dist-tags']['quarantine-latest']).toBeUndefined()
    spy.mockRestore()
  })

  it('treats NaN minutes as 0 (no quarantine)', async () => {
    const now = new Date()
    const time = {
      '1.0.0': new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    }
    const upstreamPayload = { 'dist-tags': { latest: '1.0.0' }, time }
    const spy = mockUpstream(upstreamPayload)
    // NaN をわざと渡す
    const app = createApp({ ...base, quarantineMinutes: Number('invalid') })
    const res = await app.request('/pkg')
    const body = await res.json()
    expect(body['dist-tags'].latest).toBe('1.0.0')
    expect(body['dist-tags']['quarantine-latest']).toBeUndefined()
    spy.mockRestore()
  })
})
