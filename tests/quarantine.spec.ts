import { describe, it, expect } from 'vitest'
import { applyQuarantine, QuarantineNoSafePolicy } from '../src/quarantine'
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
})
