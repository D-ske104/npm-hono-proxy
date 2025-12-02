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
    } else {
      // Quarantine対象: バージョン一覧から削除
      if (versions && versions[v]) {
        delete versions[v]
      }
    }
  }

  // 2. dist-tags の整合性を取る
  // latest が安全でない場合、安全なバージョンの中で最新のものに向ける
  const currentLatest = distTags.latest
  if (currentLatest && !safeVersions.has(currentLatest)) {
    // 元のlatestを退避
    distTags['quarantine-latest'] = currentLatest

    // 安全なバージョンの中で一番新しいものを探す
    const sortedSafe = Array.from(safeVersions).sort((a, b) => {
      return new Date(timeData[b]).getTime() - new Date(timeData[a]).getTime()
    })

    if (sortedSafe.length > 0) {
      distTags.latest = sortedSafe[0]
    } else {
      // 安全なバージョンが一つもない場合
      if (policyOnNoSafe === 'fail') {
        throw new Error('No safe versions available within quarantine policy')
      }
      delete distTags.latest
    }
  }

  // その他のタグも、削除されたバージョンを指していたら削除する
  for (const [tag, ver] of Object.entries(distTags)) {
    if (tag === 'latest' || tag === 'quarantine-latest') continue
    if (!safeVersions.has(ver)) {
      delete distTags[tag]
    }
  }
}
