import { describe, it, expect } from 'vitest'
import { filterQuarantinedMetadata } from '../src/helpers/quarantine'
import type { DistTags, NpmTimeMap, NpmMeta } from '../src/types/npm'

function buildTimeMap(base: Date, offsetsMinutes: Record<string, number>): NpmTimeMap {
  const map: NpmTimeMap = {}
  for (const [ver, offset] of Object.entries(offsetsMinutes)) {
    map[ver] = new Date(base.getTime() - offset * 60 * 1000).toISOString()
  }
  return map
}

function createMeta(distTags: DistTags, time: NpmTimeMap, versions: Record<string, any> = {}): NpmMeta {
  return {
    _id: 'pkg',
    name: 'pkg',
    'dist-tags': distTags,
    versions,
    time
  }
}

describe('filterQuarantinedMetadata (分単位の閾値)', () => {
  it('最新バージョンが閾値未満の場合、quarantine-latestに退避し、安全なバージョンにlatestを付け替える', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    // Mock Date.now
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
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

      const data = createMeta(distTags, time, versions)
      const { filteredData, latestModified } = filterQuarantinedMetadata(data, 60)

      expect(latestModified).toBe(true)
      expect(filteredData['dist-tags']?.['quarantine-latest']).toBe('3.0.0')
      // semver 最大が latest
      expect(filteredData['dist-tags']?.latest).toBe('2.0.0')
      expect(filteredData.versions?.['3.0.0']).toBeUndefined()
      expect(filteredData.versions?.['2.0.0']).toBeDefined()
    } finally {
      Date.now = originalNow
    }
  })

  it('安全なバージョンがない場合、latestを削除し、quarantine-latestのみを残す', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
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

      const data = createMeta(distTags, time, versions)
      const { filteredData, latestModified } = filterQuarantinedMetadata(data, 60)

      expect(latestModified).toBe(true)
      expect(filteredData['dist-tags']?.['quarantine-latest']).toBe('1.2.0')
      expect(filteredData['dist-tags']?.latest).toBeUndefined()
      expect(Object.keys(filteredData.versions || {}).length).toBe(0)
    } finally {
      Date.now = originalNow
    }
  })

  it('閾値以上の場合、何も変更しない（最新バージョンが既に安全）', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
      const distTags: DistTags = { latest: '1.0.0' }
      const versions = { '1.0.0': {} }
      const time = buildTimeMap(now, { '1.0.0': 600 })

      const data = createMeta(distTags, time, versions)
      const { filteredData, latestModified } = filterQuarantinedMetadata(data, 60)

      expect(latestModified).toBe(false)
      expect(filteredData['dist-tags']?.['quarantine-latest']).toBeUndefined()
      expect(filteredData['dist-tags']?.latest).toBe('1.0.0')
      expect(filteredData.versions?.['1.0.0']).toBeDefined()
    } finally {
      Date.now = originalNow
    }
  })

  it('timeに不正なISO文字列が混在していても、不正なものを除外して判定する', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
      const distTags: DistTags = { latest: '2.0.0' }
      const versions = {
        '1.0.0': {},
        '2.0.0': {},
      }
      const time: NpmTimeMap = {
        '1.0.0': new Date(now.getTime() - 5000 * 60 * 1000).toISOString(),
        '2.0.0': 'invalid-iso',
      }

      const data = createMeta(distTags, time, versions)
      const { filteredData, latestModified } = filterQuarantinedMetadata(data, 60)

      // 2.0.0 は time が不正なので安全とみなされず、除外される
      // latest は 2.0.0 だったので、quarantine-latest に退避され、latest は 1.0.0 になるはず
      // ただし、filterQuarantinedMetadataの実装では、timeがない/不正なバージョンは「安全でない」とみなされる

      expect(latestModified).toBe(true)
      expect(filteredData['dist-tags']?.['quarantine-latest']).toBe('2.0.0')
      expect(filteredData['dist-tags']?.latest).toBe('1.0.0')
      expect(filteredData.versions?.['2.0.0']).toBeUndefined()
      expect(filteredData.versions?.['1.0.0']).toBeDefined()
    } finally {
      Date.now = originalNow
    }
  })

  it('timeのcreated/modifiedは候補から除外される', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
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

      const data = createMeta(distTags, time, versions)
      const { filteredData, latestModified } = filterQuarantinedMetadata(data, 60)

      expect(latestModified).toBe(true)
      expect(filteredData['dist-tags']?.['quarantine-latest']).toBe('2.0.0')
      expect(filteredData['dist-tags']?.latest).toBe('1.0.0')
      expect(filteredData.versions?.['2.0.0']).toBeUndefined()
    } finally {
      Date.now = originalNow
    }
  })

  it('閾値ちょうどのバージョンは安全と見なされる（>=）', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
      const distTags: DistTags = { latest: '1.0.0' }
      const versions = { '1.0.0': {} }
      const time = buildTimeMap(now, { '1.0.0': 60 })

      const data = createMeta(distTags, time, versions)
      const { filteredData, latestModified } = filterQuarantinedMetadata(data, 60)

      expect(latestModified).toBe(false)
      expect(filteredData['dist-tags']?.['quarantine-latest']).toBeUndefined()
      expect(filteredData['dist-tags']?.latest).toBe('1.0.0')
    } finally {
      Date.now = originalNow
    }
  })

  it('複数のバージョンが同じタイムスタンプでも semver 最大を選ぶ', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
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

      const data = createMeta(distTags, time, versions)
      const { filteredData } = filterQuarantinedMetadata(data, 60)

      expect(filteredData['dist-tags']?.latest).toBe('2.0.0')
      expect(filteredData['dist-tags']?.['quarantine-latest']).toBe('3.0.0')
    } finally {
      Date.now = originalNow
    }
  })

  it('安全でないバージョンを指すdist-tagは削除される', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
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

      const data = createMeta(distTags, time, versions)
      const { filteredData } = filterQuarantinedMetadata(data, 60)

      expect(filteredData['dist-tags']?.latest).toBe('2.0.0')
      expect(filteredData['dist-tags']?.beta).toBeUndefined()
      expect(filteredData['dist-tags']?.stable).toBe('2.0.0')
      expect(filteredData['dist-tags']?.['quarantine-latest']).toBe('3.0.0')
    } finally {
      Date.now = originalNow
    }
  })

  it('時間が新しいが semver が小さいものより、semver が大きい古い安全版を選ぶ', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
      const distTags: DistTags = { latest: '2.0.0' }
      const versions = { '1.9.9': {}, '2.0.0': {}, '1.5.0': {} }
      const time = buildTimeMap(now, {
        '1.9.9': 100, // 最近
        '2.0.0': 5000, // 古い
        '1.5.0': 6000,
      })

      const data = createMeta(distTags, time, versions)
      const { filteredData } = filterQuarantinedMetadata(data, 60)

      expect(filteredData['dist-tags']?.latest).toBe('2.0.0')
    } finally {
      Date.now = originalNow
    }
  })

  it('semver として不正なキーは安全候補へ含めない', () => {
    const now = new Date('2025-12-01T12:00:00Z')
    const originalNow = Date.now
    Date.now = () => now.getTime()

    try {
      const distTags: DistTags = { latest: '3.0.0' }
      const versions = { '3.0.0': {}, bad_version: {}, '2.0.0': {} }
      const time = buildTimeMap(now, {
        '3.0.0': 30, // 隔離対象
        bad_version: 8000, // 形式不正
        '2.0.0': 5000, // 安全
      })

      const data = createMeta(distTags, time, versions)
      const { filteredData } = filterQuarantinedMetadata(data, 60)

      expect(filteredData['dist-tags']?.latest).toBe('2.0.0')
      // versions からは削除されない (timeがない/不正なものは安全でないとみなされるが、
      // filterQuarantinedMetadataの実装では、timeにキーがあるものだけがsafeVersionsに追加される。
      // versionsのループでsafeVersionsにないものは削除される。
      // bad_version は semver.valid で弾かれるので safeVersions に入らない -> 削除されるはず)
      expect(filteredData.versions?.bad_version).toBeUndefined()
    } finally {
      Date.now = originalNow
    }
  })
})
