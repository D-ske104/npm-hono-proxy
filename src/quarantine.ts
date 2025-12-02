import type { DistTags, NpmTimeMap } from './types/npm'

export type QuarantineNoSafePolicy = 'set-safe' | 'fail'

// 日付文字列の妥当性を検証するヘルパー関数
const isValidDate = (s: string | undefined): boolean => {
  if (!s) return false
  const n = Date.parse(s)
  return Number.isFinite(n)
}

// 安全なバージョンを特定する共通ヘルパー関数
function getSafeVersions(
  timeData: NpmTimeMap,
  now: Date,
  minutesThreshold: number
): Set<string> {
  const safeVersions = new Set<string>()
  const allVersions = Object.keys(timeData).filter(
    (v) => v !== 'created' && v !== 'modified'
  )

  for (const v of allVersions) {
    if (!isValidDate(timeData[v])) continue
    const pDate = new Date(timeData[v])
    const diffMinutes = (now.getTime() - pDate.getTime()) / (1000 * 60)
    if (diffMinutes >= minutesThreshold) {
      safeVersions.add(v)
    }
  }
  return safeVersions
}

export function applyQuarantine(
  distTags: DistTags | undefined,
  timeData: NpmTimeMap | undefined,
  versions: Record<string, unknown> | undefined,
  now: Date,
  minutesThreshold: number,
  policyOnNoSafe: QuarantineNoSafePolicy = 'set-safe'
): void {
  if (!distTags || !timeData) return

  // 1. 安全なバージョンを特定する
  const safeVersions = getSafeVersions(timeData, now, minutesThreshold)

  // 2. versions と dist-tags から安全でないものを削除
  // versionsから安全でないものを削除
  if (versions) {
    for (const v of Object.keys(versions)) {
      if (!safeVersions.has(v)) {
        delete versions[v]
      }
    }
  }

  // dist-tagsから安全でないものを削除
  let latestWasRemoved = false
  for (const [tag, ver] of Object.entries(distTags)) {
    if (!safeVersions.has(ver)) {
      if (tag === 'latest') {
        latestWasRemoved = true
        distTags['quarantine-latest'] = ver
      }
      delete distTags[tag]
    }
  }

  // 3. latest タグを再設定
  if (latestWasRemoved) {
    const sortedSafe = Array.from(safeVersions).sort((a, b) => {
      return new Date(timeData[b]).getTime() - new Date(timeData[a]).getTime()
    })

    if (sortedSafe.length > 0) {
      distTags.latest = sortedSafe[0]
    } else {
      if (policyOnNoSafe === 'fail') {
        throw new Error('No safe versions available within quarantine policy')
      }
      // 'latest' は既に削除されているため、'set-safe' ポリシーでは何もしない
    }
  }
}

export function findQuarantinedVersion(
  version: string,
  timeData: NpmTimeMap | undefined,
  now: Date,
  minutesThreshold: number
): { quarantined: boolean; latestSafeVersion?: string } {
  if (!timeData) return { quarantined: false }

  // 1. 要求されたバージョンが隔離対象かチェック
  const versionTime = timeData[version]
  if (isValidDate(versionTime)) {
    const pDate = new Date(versionTime)
    const diffMinutes = (now.getTime() - pDate.getTime()) / (1000 * 60)
    if (diffMinutes < minutesThreshold) {
      // 2. 隔離対象の場合、安全な最新バージョンを探す
      const safeVersions = getSafeVersions(timeData, now, minutesThreshold)

      const sortedSafe = Array.from(safeVersions).sort((a, b) => {
        return new Date(timeData[b]).getTime() - new Date(timeData[a]).getTime()
      })

      return {
        quarantined: true,
        latestSafeVersion: sortedSafe.length > 0 ? sortedSafe[0] : undefined,
      }
    }
  }

  return { quarantined: false }
}
