import { describe, it, expect } from 'vitest'
import { applyQuarantine } from '../src/quarantine'
import type { DistTags, NpmTimeMap } from '../src/types/npm'

function buildTimeMap(base: Date, offsetsMinutes: Record<string, number>): NpmTimeMap {
  const map: NpmTimeMap = {}
  for (const [ver, offset] of Object.entries(offsetsMinutes)) {
    map[ver] = new Date(base.getTime() - offset * 60 * 1000).toISOString()
  }
  return map
}

describe('applyQuarantine (minutes threshold)', () => {
  it('最新が閾値未満なら quarantine-latest に退避し安全版へ latest を付け替える', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '3.0.0' }
    const time = buildTimeMap(now, {
      '1.0.0': 10000, // 古い
      '2.0.0': 5000,  // 閾値より古い
      '3.0.0': 30,    // 新しく隔離対象
    })
    applyQuarantine(distTags, time, now, /*threshold minutes*/ 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBe('3.0.0')
    // 安全版候補: 2.0.0 (5000m), 1.0.0 (10000m) → 最も新しい安全版は 2.0.0
    expect(distTags.latest).toBe('2.0.0')
  })

  it('安全版が無い場合 set-safe は latest を削除し quarantine-latest のみ残す', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.2.0' }
    const time = buildTimeMap(now, {
      '1.0.0': 10,
      '1.1.0': 20,
      '1.2.0': 5,
    })
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBe('1.2.0')
    expect(distTags.latest).toBeUndefined()
  })

  it('安全版が無い場合 fail ポリシーは例外を投げる', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '0.3.0' }
    const time = buildTimeMap(now, {
      '0.1.0': 5,
      '0.2.0': 10,
      '0.3.0': 2,
    })
    expect(() => applyQuarantine(distTags, time, now, 60, 'fail')).toThrow()
  })

  it('閾値以上なら何も変更しない (最新が既に安全)', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.0.0' }
    const time = buildTimeMap(now, { '1.0.0': 600 }) // 600m > 60m threshold
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBeUndefined()
    expect(distTags.latest).toBe('1.0.0')
  })

  it('dist-tags もしくは time が欠けている場合は何もしない', () => {
    const now = new Date()
    const distTags: DistTags = { latest: '1.0.0' }
    applyQuarantine(distTags, undefined, now, 60, 'set-safe')
    expect(distTags.latest).toBe('1.0.0')
  })

  it('time に不正 ISO 文字列が混在しても不正は除外して判定', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '2.0.0' }
    const time: NpmTimeMap = {
      '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(),
      '2.0.0': 'invalid-iso',
    }
    // latest の日時が不正なので隔離はスキップ（何もしない）
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBeUndefined()
    expect(distTags.latest).toBe('2.0.0')
  })

  it('time の created/modified は候補から除外される', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '2.0.0' }
    const time: NpmTimeMap = {
      '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(),
      '2.0.0': new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      created: new Date(now.getTime() - 6000 * 60 * 1000).toISOString(),
      modified: new Date(now.getTime() - 100 * 60 * 1000).toISOString(),
    }
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBe('2.0.0')
    expect(distTags.latest).toBe('1.0.0')
  })

  it('閾値ちょうどの版は安全（>= は安全）', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.0.0' }
    const time = buildTimeMap(now, { '1.0.0': 60 })
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBeUndefined()
    expect(distTags.latest).toBe('1.0.0')
  })

  it('同一タイムスタンプが複数でも安全版選定は安定', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '3.0.0' }
    const same = new Date(now.getTime() - 5000 * 60 * 1000).toISOString()
    const time: NpmTimeMap = {
      '1.0.0': same,
      '2.0.0': same,
      '3.0.0': new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    }
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    // 実装は降順ソートの先頭を選択（キー順には依存しない）。
    expect(['1.0.0', '2.0.0']).toContain(distTags.latest!)
    expect(distTags['quarantine-latest']).toBe('3.0.0')
  })
})
