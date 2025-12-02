import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

describe('integration: メタデータの隔離フロー', () => {
  it('最新バージョンが隔離期間内の場合、latestを書き換えない', async () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const time = {
      // 1.0.0 は 5000 分前 (閾値 60 分より十分古い = 安全)
      '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(),
      // 2.0.0 は 30 分前 (閾値未満 = 隔離対象)
      '2.0.0': new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    }
    const upstreamPayload = { 'dist-tags': { latest: '2.0.0' }, time }
    const spy = mockUpstream(upstreamPayload)
    const app = createApp(baseConfig)
    const res = await app.request('/pkg')
    const body = await res.json()
    // 現仕様では latest は維持され、隔離は行われない
    expect(body['dist-tags'].latest).toBe('2.0.0')
    expect(body['dist-tags']['quarantine-latest']).toBeUndefined()
    spy.mockRestore()
  })

  it('ポリシーがfailで安全なバージョンがない場合、200を返す（ブロックしない）', async () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const time = {
      // いずれも閾値 60 分未満なので安全なバージョンが存在しないケース
      '1.0.0': new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      '1.1.0': new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
    }
    const upstreamPayload = { 'dist-tags': { latest: '1.1.0' }, time }
    const spy = mockUpstream(upstreamPayload)
    const app = createApp({ ...baseConfig, quarantinePolicyOnNoSafe: 'fail' })
    const res = await app.request('/pkg')
    expect(res.status).toBe(200)
    const body = await res.json()
    // 現仕様では fail ポリシーでもブロックせず、そのまま dist-tags を返す
    expect(body['dist-tags'].latest).toBe('1.1.0')
    spy.mockRestore()
  })

  it('JSONでないコンテンツはリダイレクトする', async () => {
    const spy = mockUpstream('tarball-data', 'application/octet-stream')
    const app = createApp(baseConfig)
    const res = await app.request('/pkg/-/pkg-1.0.0.tgz')
    // Honoのリダイレクトは302を返す
    expect(res.status).toBe(302)
    spy.mockRestore()
  })
})

describe('integration: 特定バージョンのリクエスト', () => {
  const now = new Date('2025-12-01T12:00:00Z')
  const time = {
    '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(), // 安全
    '2.0.0': new Date(now.getTime() - 30 * 60 * 1000).toISOString(),   // 隔離対象
  }
  const upstreamPayload = { name: 'pkg', time, versions: { '1.0.0': {}, '2.0.0': {} } }

  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchSpy = vi.spyOn(globalThis, 'fetch' as any)
  })
  afterEach(() => {
    fetchSpy.mockRestore()
    vi.useRealTimers()
  })

  it('隔離対象のバージョンをリクエストした場合、404とカスタムエラーを返す', async () => {
    const metaRes = new Response(JSON.stringify(upstreamPayload))
    fetchSpy.mockResolvedValueOnce(metaRes)

    vi.setSystemTime(now)
    const app = createApp(baseConfig)
    const res = await app.request('/pkg/2.0.0')

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Quarantine Policy')
    expect(body.latestSafeVersion).toBe('1.0.0')
    // メタデータ取得のために1回だけ呼ばれる
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('安全なバージョンをリクエストした場合、通常通りプロキシする', async () => {
    const metaRes = new Response(JSON.stringify(upstreamPayload))
    const tarballRes = new Response('tarball-data')
    fetchSpy.mockResolvedValueOnce(metaRes).mockResolvedValueOnce(tarballRes)

    vi.setSystemTime(now)
    const app = createApp(baseConfig)
    const res = await app.request('/pkg/1.0.0')

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('tarball-data')
    // 1. メタデータ取得, 2. ターボール取得 の2回呼ばれる
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('Quarantineが無効の場合、隔離対象バージョンも通常通りプロキシする', async () => {
    const metaRes = new Response(JSON.stringify(upstreamPayload))
    const tarballRes = new Response('tarball-data-2.0.0')
    fetchSpy.mockResolvedValueOnce(metaRes).mockResolvedValueOnce(tarballRes)

    vi.setSystemTime(now)
    const app = createApp({ ...baseConfig, quarantineEnabled: false })
    const res = await app.request('/pkg/2.0.0')

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('tarball-data-2.0.0')
    // 1. メタデータ取得, 2. ターボール取得 の2回呼ばれる
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
