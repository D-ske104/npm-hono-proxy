import semver from 'semver'
import { NpmMeta } from '../types/npm'

/**
 * メタデータから指定期間内の新しいバージョンを除外する
 */
export function filterQuarantinedMetadata(data: NpmMeta, thresholdMinutes: number) {
  const now = Date.now()
  const thresholdMs = thresholdMinutes * 60 * 1000
  
  // 検疫期間外(安全)なバージョンのセットを作成
  const safeVersions = new Set<string>()

  // 1. timeフィールドを見て安全なバージョンを特定
  if (data.time) {
    for (const [version, timeStr] of Object.entries(data.time)) {
      if (!semver.valid(version)) continue
      
      const publishTime = new Date(timeStr).getTime()
      if (now - publishTime >= thresholdMs) {
        safeVersions.add(version)
      }
    }
  }

  // 2. versions オブジェクトから検疫対象を削除
  if (data.versions) {
    for (const v of Object.keys(data.versions)) {
      if (!safeVersions.has(v)) {
        delete data.versions[v]
      }
    }
  }

  // 3. dist-tags の整合性を取る
  let latestModified = false
  const distTags = data['dist-tags'] || {}
  
  for (const [tag, version] of Object.entries(distTags)) {
    if (!safeVersions.has(version)) {
      // ★ ここで隔離された「本来のlatest」を別名で残す
      if (tag === 'latest') {
        distTags['quarantine-latest'] = version
        latestModified = true
      }
      
      // 安全でないバージョンを指すタグは削除
      delete distTags[tag]
    }
  }

  // 4. latest が消えた場合の再計算
  if (latestModified) {
    // 安全なバージョンの中から semver 的に最も新しいものを探す
    const sortedSafe = Array.from(safeVersions).sort(semver.rcompare)
    
    if (sortedSafe.length > 0) {
      // 過去の安全なバージョンを latest に昇格させる
      distTags.latest = sortedSafe[0]
    } else {
      // 安全なバージョンが一つもない場合
      // latestタグ自体が存在しない状態にする -> npm install は ETARGET エラーになる
    }
  }

  return { filteredData: data, latestModified }
}
