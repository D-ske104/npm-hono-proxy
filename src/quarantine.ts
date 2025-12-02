import type { DistTags, NpmTimeMap } from './types/npm'

export type QuarantineNoSafePolicy = 'set-safe' | 'fail'

export function applyQuarantine(
  distTags: DistTags | undefined,
  timeData: NpmTimeMap | undefined,
  versions: Record<string, unknown> | undefined,
  now: Date,
  minutesThreshold: number,
  policyOnNoSafe: QuarantineNoSafePolicy = 'set-safe'
): void {
  if (!distTags || !timeData) return

  // 日付文字列の妥当性を検証 (不正なISO文字列を除外)
  const isValidDate = (s: string | undefined): boolean => {
    if (!s) return false
    const n = Date.parse(s)
    return Number.isFinite(n)
  }

  // 1. 安全なバージョンを特定する
  const safeVersions = new Set<string>()
  const allVersions = Object.keys(timeData).filter(v => v !== 'created' && v !== 'modified')

  for (const v of allVersions) {
    if (!isValidDate(timeData[v])) continue
    const pDate = new Date(timeData[v])
    const diffMinutes = (now.getTime() - pDate.getTime()) / (1000 * 60)
    if (diffMinutes >= minutesThreshold) {
      safeVersions.add(v)
    }
  }

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
