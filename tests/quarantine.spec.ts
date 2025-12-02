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

describe('applyQuarantine (分単位の閾値)', () => {
  it('最新バージョンが閾値未満の場合、quarantine-latestに退避し、安全なバージョンにlatestを付け替える', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '3.0.0' }
    const time = buildTimeMap(now, {
      '1.0.0': 10000, // 古い
      '2.0.0': 5000,  // 閾値より古い
      '3.0.0': 30,    // 新しく隔離対象
    })
    applyQuarantine(distTags, time, now, /*threshold minutes*/ 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBe('3.0.0')
    // 安全なバージョンの候補: 2.0.0 (5000分前), 1.0.0 (10000分前) → 最も新しい安全なバージョンは 2.0.0
    expect(distTags.latest).toBe('2.0.0')
  })

  it('安全なバージョンがない場合、set-safeポリシーはlatestを削除し、quarantine-latestのみを残す', () => {
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

  it('安全なバージョンがない場合、failポリシーは例外を投げる', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '0.3.0' }
    const time = buildTimeMap(now, {
      '0.1.0': 5,
      '0.2.0': 10,
      '0.3.0': 2,
    })
    expect(() => applyQuarantine(distTags, time, now, 60, 'fail')).toThrow()
  })

  it('閾値以上の場合、何も変更しない（最新バージョンが既に安全）', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.0.0' }
    const time = buildTimeMap(now, { '1.0.0': 600 }) // 600分 > 60分の閾値
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBeUndefined()
    expect(distTags.latest).toBe('1.0.0')
  })

  it('dist-tagsまたはtimeが欠けている場合、何もしない', () => {
    const now = new Date()
    const distTags: DistTags = { latest: '1.0.0' }
    applyQuarantine(distTags, undefined, now, 60, 'set-safe')
    expect(distTags.latest).toBe('1.0.0')
  })

  it('timeに不正なISO文字列が混在していても、不正なものを除外して判定する', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '2.0.0' }
    const time: NpmTimeMap = {
      '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(),
      '2.0.0': 'invalid-iso',
    }
    // latestの日時が不正なため、隔離はスキップされる（何もしない）
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBeUndefined()
    expect(distTags.latest).toBe('2.0.0')
  })

  it('timeのcreated/modifiedは候補から除外される', () => {
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

  it('閾値ちょうどのバージョンは安全と見なされる（>=）', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.0.0' }
    const time = buildTimeMap(now, { '1.0.0': 60 })
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBeUndefined()
    expect(distTags.latest).toBe('1.0.0')
  })

  it('複数のバージョンが同じタイムスタンプを持っていても、安全なバージョンの選定は安定している', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '3.0.0' }
    const same = new Date(now.getTime() - 5000 * 60 * 1000).toISOString()
    const time: NpmTimeMap = {
      '1.0.0': same,
      '2.0.0': same,
      '3.0.0': new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    }
    applyQuarantine(distTags, time, now, 60, 'set-safe')
    // 実装では降順ソートの最初の要素が選択される（キーの順序には依存しない）
    expect(['1.0.0', '2.0.0']).toContain(distTags.latest!)
    expect(distTags['quarantine-latest']).toBe('3.0.0')
  })
})
