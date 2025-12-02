import type { DistTags, NpmTimeMap } from './types/npm'

export type QuarantineNoSafePolicy = 'set-safe' | 'fail'

export function applyQuarantine(
  distTags: DistTags | undefined,
  timeData: NpmTimeMap | undefined,
  now: Date,
  minutesThreshold: number,
  policyOnNoSafe: QuarantineNoSafePolicy = 'set-safe'
): void {
  const currentLatestVer: string | undefined = distTags?.latest
  if (!distTags || !timeData || currentLatestVer === undefined) return

  // 日付の妥当性検証（ISO文字列が不正なものを除外）
  const isValidDate = (s: string | undefined): boolean => {
    if (!s) return false
    const n = Date.parse(s)
    return Number.isFinite(n)
  }
  if (!isValidDate(timeData[currentLatestVer])) return

  const publishDate = new Date(timeData[currentLatestVer])
  const diffMinutes = (now.getTime() - publishDate.getTime()) / (1000 * 60)

  if (diffMinutes < minutesThreshold) {
    // ポリシーにより latest を剥奪。元の最新を 'quarantine-latest' に退避
    distTags['quarantine-latest'] = currentLatestVer

    const safeVersions = Object.keys(timeData).filter((v) => {
      if (v === 'created' || v === 'modified') return false
      if (!isValidDate(timeData[v])) return false
      const pDate = new Date(timeData[v])
      const dMinutes = (now.getTime() - pDate.getTime()) / (1000 * 60)
      return dMinutes >= minutesThreshold
    })

    safeVersions.sort((a, b) => {
      return new Date(timeData[b]).getTime() - new Date(timeData[a]).getTime()
    })

    if (safeVersions.length > 0) {
      distTags.latest = safeVersions[0]
    } else {
      if (policyOnNoSafe === 'fail') {
        throw new Error('No safe versions available within quarantine policy')
      }
      // 'set-safe' の場合でも安全版がないため、latest を設定できない。
      // 意図しないインストールを避けるため latest を削除する。
      delete distTags.latest
    }
  }
}
