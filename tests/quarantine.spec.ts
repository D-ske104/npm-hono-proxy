import { describe, it, expect } from 'vitest'
import { applyQuarantine, findQuarantinedVersion } from '../src/quarantine'
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
    const versions = {
      '1.0.0': {},
      '2.0.0': {},
      '3.0.0': {},
    }
    const time = buildTimeMap(now, {
      '1.0.0': 10000, // 古い
      '2.0.0': 5000, // 閾値より古い
      '3.0.0': 30, // 新しく隔離対象
    })
    applyQuarantine(distTags, time, versions, now, /*threshold minutes*/ 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBe('3.0.0')
    // semver 最大が latest
    expect(distTags.latest).toBe('2.0.0')
    expect(versions['3.0.0']).toBeUndefined()
    expect(versions['2.0.0']).toBeDefined()
  })

  it('安全なバージョンがない場合、set-safeポリシーはlatestを削除し、quarantine-latestのみを残す', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.2.0' }
    const versions = {
      '1.0.0': {},
      '1.1.0': {},
      '1.2.0': {},
    }
    const time = buildTimeMap(now, {
      '1.0.0': 10,
      '1.1.0': 20,
      '1.2.0': 5,
    })
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBe('1.2.0')
    expect(distTags.latest).toBeUndefined()
    expect(Object.keys(versions).length).toBe(0)
  })

  it('安全なバージョンがない場合、failポリシーは例外を投げる（メッセージは閾値含む）', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '0.3.0' }
    const versions = {}
    const time = buildTimeMap(now, {
      '0.1.0': 5,
      '0.2.0': 10,
      '0.3.0': 2,
    })
    expect(() => applyQuarantine(distTags, time, versions, now, 60, 'fail')).toThrow(
      /No safe versions available within quarantine policy/
    )
  })

  it('閾値以上の場合、何も変更しない（最新バージョンが既に安全）', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.0.0' }
    const versions = { '1.0.0': {} }
    const time = buildTimeMap(now, { '1.0.0': 600 })
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBeUndefined()
    expect(distTags.latest).toBe('1.0.0')
    expect(versions['1.0.0']).toBeDefined()
  })

  it('dist-tagsまたはtimeが欠けている場合、何もしない', () => {
    const now = new Date()
    const distTags: DistTags = { latest: '1.0.0' }
    const versions = { '1.0.0': {} }
    applyQuarantine(distTags, undefined, versions, now, 60, 'set-safe')
    expect(distTags.latest).toBe('1.0.0')
  })

  it('timeに不正なISO文字列が混在していても、不正なものを除外して判定する', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '2.0.0' }
    const versions = {
      '1.0.0': {},
      '2.0.0': {},
    }
    const time: NpmTimeMap = {
      '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(),
      '2.0.0': 'invalid-iso',
    }
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBe('2.0.0')
    expect(distTags.latest).toBe('1.0.0')
    expect(versions['2.0.0']).toBeUndefined()
    expect(versions['1.0.0']).toBeDefined()
  })

  it('timeのcreated/modifiedは候補から除外される', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '2.0.0' }
    const versions = {
      '1.0.0': {},
      '2.0.0': {},
    }
    const time: NpmTimeMap = {
      '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(),
      '2.0.0': new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      created: new Date(now.getTime() - 6000 * 60 * 1000).toISOString(),
      modified: new Date(now.getTime() - 100 * 60 * 1000).toISOString(),
    }
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBe('2.0.0')
    expect(distTags.latest).toBe('1.0.0')
    expect(versions['2.0.0']).toBeUndefined()
  })

  it('閾値ちょうどのバージョンは安全と見なされる（>=）', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.0.0' }
    const versions = { '1.0.0': {} }
    const time = buildTimeMap(now, { '1.0.0': 60 })
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags['quarantine-latest']).toBeUndefined()
    expect(distTags.latest).toBe('1.0.0')
  })

  it('複数のバージョンが同じタイムスタンプでも semver 最大を選ぶ', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '3.0.0' }
    const versions = {
      '1.0.0': {},
      '2.0.0': {},
      '3.0.0': {},
    }
    const same = new Date(now.getTime() - 5000 * 60 * 1000).toISOString()
    const time: NpmTimeMap = {
      '1.0.0': same,
      '2.0.0': same,
      '3.0.0': new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    }
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags.latest).toBe('2.0.0')
    expect(distTags['quarantine-latest']).toBe('3.0.0')
  })

  it('安全でないバージョンを指すdist-tagは削除される', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = {
      latest: '3.0.0',
      beta: '3.0.0',
      stable: '2.0.0',
    }
    const versions = {
      '1.0.0': {},
      '2.0.0': {},
      '3.0.0': {},
    }
    const time = buildTimeMap(now, {
      '1.0.0': 10000,
      '2.0.0': 5000,
      '3.0.0': 30,
    })
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags.latest).toBe('2.0.0')
    expect(distTags.beta).toBeUndefined()
    expect(distTags.stable).toBe('2.0.0')
    expect(distTags['quarantine-latest']).toBe('3.0.0')
  })

  it('versionsがundefinedでもエラーにならない', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '3.0.0' }
    const time = buildTimeMap(now, {
      '1.0.0': 10000,
      '2.0.0': 5000,
      '3.0.0': 30,
    })
    expect(() => applyQuarantine(distTags, time, undefined, now, 60, 'set-safe')).not.toThrow()
    expect(distTags.latest).toBe('2.0.0')
  })

  it('latestが隔離され、他に安全なバージョンがない場合、failポリシーは例外を投げる', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '1.2.0' }
    const versions = {
      '1.0.0': {},
      '1.1.0': {},
      '1.2.0': {},
    }
    const time = buildTimeMap(now, {
      '1.0.0': 10,
      '1.1.0': 20,
      '1.2.0': 5,
    })
    expect(() => applyQuarantine(distTags, time, versions, now, 60, 'fail')).toThrow(
      /No safe versions available within quarantine policy/
    )
  })

  it('時間が新しいが semver が小さいものより、semver が大きい古い安全版を選ぶ', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '2.0.0' }
    const versions = { '1.9.9': {}, '2.0.0': {}, '1.5.0': {} }
    const time = buildTimeMap(now, {
      '1.9.9': 100, // 最近
      '2.0.0': 5000, // 古い
      '1.5.0': 6000,
    })
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags.latest).toBe('2.0.0')
  })

  it('semver として不正なキーは安全候補へ含めない', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const distTags: DistTags = { latest: '3.0.0' }
    const versions = { '3.0.0': {}, bad_version: {}, '2.0.0': {} }
    const time = buildTimeMap(now, {
      '3.0.0': 30, // 隔離対象
      bad_version: 8000, // 形式不正
      '2.0.0': 5000, // 安全
    })
    applyQuarantine(distTags, time, versions, now, 60, 'set-safe')
    expect(distTags.latest).toBe('2.0.0')
    expect(versions.bad_version).toBeDefined()
  })
})

describe('findQuarantinedVersion', () => {
  const now = new Date('2025-12-01T12:00:00Z')
  const time = buildTimeMap(now, {
    '1.0.0': 10000, // 安全
    '2.0.0': 5000, // 安全
    '3.0.0': 30, // 隔離対象
  })

  it('隔離対象のバージョンを正しく判定し、安全な最新バージョンを返す', () => {
    const result = findQuarantinedVersion('3.0.0', time, now, 60)
    expect(result.quarantined).toBe(true)
    expect(result.latestSafeVersion).toBe('2.0.0')
  })

  it('安全なバージョンを正しく判定する', () => {
    const result = findQuarantinedVersion('2.0.0', time, now, 60)
    expect(result.quarantined).toBe(false)
  })

  it('timeデータに存在しないバージョンは隔離対象外とする', () => {
    const result = findQuarantinedVersion('9.9.9', time, now, 60)
    expect(result.quarantined).toBe(false)
  })

  it('timeデータがundefinedの場合、隔離対象外とする', () => {
    const result = findQuarantinedVersion('3.0.0', undefined, now, 60)
    expect(result.quarantined).toBe(false)
  })

  it('安全なバージョンが一つもない場合、latestSafeVersionはundefinedになる', () => {
    const onlyUnsafeTime = buildTimeMap(now, {
      '1.0.0': 10,
      '2.0.0': 20,
    })
    const result = findQuarantinedVersion('1.0.0', onlyUnsafeTime, now, 60)
    expect(result.quarantined).toBe(true)
    expect(result.latestSafeVersion).toBeUndefined()
  })
})
