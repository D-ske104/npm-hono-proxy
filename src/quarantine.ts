import type { DistTags, NpmTimeMap } from './types/npm'
import semver from 'semver'

export type QuarantineNoSafePolicy = 'set-safe' | 'fail'

// 日付文字列の妥当性を検証するヘルパー関数
const isValidDate = (s: string | undefined): boolean => {
  if (!s) return false
  const n = Date.parse(s)
  return Number.isFinite(n)
}

// 安全なバージョン候補を返す（semver不正キーは除外）
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
    if (!semver.valid(v)) continue
    if (!isValidDate(timeData[v])) continue
    const pDate = new Date(timeData[v]!)
    const diffMinutes = (now.getTime() - pDate.getTime()) / (1000 * 60)
    if (diffMinutes >= minutesThreshold) safeVersions.add(v)
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

  const safeVersions = getSafeVersions(timeData, now, minutesThreshold)

  // versions: semverとして有効で安全でないもののみ削除（不正キーは保持）
  if (versions) {
    for (const v of Object.keys(versions)) {
      if (semver.valid(v) && !safeVersions.has(v)) delete versions[v]
    }
  }

  let latestWasRemoved = false
  for (const [tag, ver] of Object.entries(distTags)) {
    if (semver.valid(ver) && !safeVersions.has(ver)) {
      if (tag === 'latest') {
        latestWasRemoved = true
        distTags['quarantine-latest'] = ver
      }
      delete distTags[tag]
    }
  }

  if (latestWasRemoved) {
    const sortedSafe = Array.from(safeVersions).sort(semver.rcompare)
    if (sortedSafe.length > 0) {
      distTags.latest = sortedSafe[0]
    } else if (policyOnNoSafe === 'fail') {
      throw new Error(
        `No safe versions available within quarantine policy (threshold ${minutesThreshold} minutes)`
      )
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
  const versionTime = timeData[version]
  if (semver.valid(version) && isValidDate(versionTime)) {
    const pDate = new Date(versionTime)
    const diffMinutes = (now.getTime() - pDate.getTime()) / (1000 * 60)
    if (diffMinutes < minutesThreshold) {
      const safeVersions = getSafeVersions(timeData, now, minutesThreshold)
      const sortedSafe = Array.from(safeVersions).sort(semver.rcompare)
      return { quarantined: true, latestSafeVersion: sortedSafe[0] }
    }
  }
  return { quarantined: false }
}
