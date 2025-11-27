import type { DistTags, NpmTimeMap } from './types/npm'

export function applyQuarantine(
  distTags: DistTags | undefined,
  timeData: NpmTimeMap | undefined,
  now: Date,
  days: number
): void {
  const currentLatestVer: string | undefined = distTags?.latest
  if (!distTags || !timeData || !currentLatestVer || !timeData[currentLatestVer]) return

  const publishDate = new Date(timeData[currentLatestVer])
  const diffDays = (now.getTime() - publishDate.getTime()) / (1000 * 3600 * 24)

  if (diffDays < days) {
    // ポリシーにより latest を剥奪。元の最新を 'quarantine-latest' に退避
    distTags['quarantine-latest'] = currentLatestVer

    const safeVersions = Object.keys(timeData).filter((v) => {
      if (v === 'created' || v === 'modified') return false
      const pDate = new Date(timeData[v])
      const dDays = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24)
      return dDays >= days
    })

    safeVersions.sort((a, b) => {
      return new Date(timeData[b]).getTime() - new Date(timeData[a]).getTime()
    })

    if (safeVersions.length > 0) {
      distTags.latest = safeVersions[0]
    } else {
      delete distTags.latest
    }
  }
}
