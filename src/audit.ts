import fs from 'node:fs/promises'
import path from 'node:path'
import semver from 'semver'
import { getConfig } from './config'
import { findQuarantinedVersion } from './quarantine'
import { fetchUpstream } from './upstream'
import { getUpstreamBase } from './utils/upstream'
import { isNpmPackageMeta } from './validate'
import fsSync from 'node:fs'

async function getPackageManifest(cwd: string) {
  const filePath = path.join(cwd, 'package.json')
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    console.error(`❌ Error reading or parsing package.json at ${filePath}`)
    process.exit(1)
  }
}

// updates には "newSpec" を格納し、既存の range より狭い (または異なる) 場合のみ適用する
async function applyFixes(
  updates: Map<string, { newSpec: string; type: 'dependencies' | 'devDependencies' }>,
  cwd: string
) {
  if (updates.size === 0) {
    // fixモードでも何も修正がない場合はメッセージを出す
    console.log('\nNo quarantined packages to fix.')
    return
  }

  console.log('\nApplying fixes to package.json...')
  const filePath = path.join(cwd, 'package.json')
  let manifestContent = await fs.readFile(filePath, 'utf-8')
  const manifest = JSON.parse(manifestContent) // Get original versions

  // Helper to escape strings for regex
  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const usePrefixMode = process.env.NPM_HONO_PROXY_AUDIT_USE_PREFIX === 'true'

  for (const [name, { newSpec, type }] of updates.entries()) {
    const currentSpec = manifest[type]?.[name]
    if (!currentSpec) continue

    let targetSpec = newSpec
    if (usePrefixMode) {
      // prefixモードでは: 元の prefix (^/~) を保持。無ければ npm のデフォルト '^' を使用。
      const prefixMatch = currentSpec.match(/^([~^])/)
      const chosenPrefix = prefixMatch ? prefixMatch[1] : '^'
      if (!targetSpec.startsWith(chosenPrefix)) {
        targetSpec = `${chosenPrefix}${targetSpec}`
      }
    } else {
      // デフォルト: 厳密指定に縮める (prefix除去)
    }

    if (currentSpec === targetSpec) continue

    console.log(`  - Auto-fix: Changing ${name} from "${currentSpec}" to "${targetSpec}"`)
    const regex = new RegExp(`("${escapeRegExp(name)}"\\s*:\\s*)"${escapeRegExp(currentSpec)}"`)
    if (regex.test(manifestContent)) {
      manifestContent = manifestContent.replace(regex, `$1"${targetSpec}"`)
    }
  }

  await fs.writeFile(filePath, manifestContent, 'utf-8')

  console.log('\n✅ package.json has been updated. Please run "npm install".')
}

export async function runAudit() {
  const isFixMode = process.env.NPM_HONO_PROXY_AUDIT_FIX === 'true'
  const command = isFixMode ? 'audit fix' : 'audit'
  console.log(`🛡️  Running npm-hono-proxy ${command}...`)
  const config = getConfig()
  const manifest = await getPackageManifest(process.cwd())
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  }

  if (Object.keys(dependencies).length === 0) {
    console.log('✅ No dependencies found to audit.')
    return
  }

  const upstreamBase = getUpstreamBase(config.logLevel, config.logFormat)
  const safeMinutes = config.quarantineMinutes
  const refNow = new Date()
  let quarantinedCount = 0
  const updatesToApply = new Map<string, { newSpec: string; type: 'dependencies' | 'devDependencies' }>()

  for (const [name, versionRange] of Object.entries(dependencies)) {
    const { res } = await fetchUpstream(`/${name}`, upstreamBase)
    if (!res.ok) {
      console.warn(`  ⚠️ Could not fetch metadata for ${name}. Skipping.`)
      continue
    }
    const meta = await res.json()
    if (!isNpmPackageMeta(meta)) {
      console.warn(`  ⚠️ Invalid metadata for ${name}. Skipping.`)
      continue
    }

    const availableVersions = Object.keys(meta.versions ?? {})
    const targetVersion = semver.maxSatisfying(availableVersions, versionRange as string)

    if (!targetVersion) {
      console.log(`  - ${name}: No version satisfies "${versionRange}". Skipping.`)
      continue
    }

    const { quarantined, latestSafeVersion } = findQuarantinedVersion(
      targetVersion,
      meta.time,
      refNow,
      safeMinutes
    )

    if (quarantined) {
      quarantinedCount++
      console.log(`  🚨 ${name}@${targetVersion} (satisfies "${versionRange}") is QUARANTINED.`)
      if (latestSafeVersion) {
        console.log(`     -> Latest safe version is ${latestSafeVersion}.`)
        if (isFixMode) {
          const type = manifest.dependencies?.[name] ? 'dependencies' : 'devDependencies'
          const currentSpec = (manifest.dependencies?.[name] || manifest.devDependencies?.[name]) as string
          const isExact = !!semver.valid(currentSpec)
          if (isExact) {
            // 正確指定が検疫対象 -> 安全版へ書き換え (最新安全版がある場合)
            if (latestSafeVersion) {
              const newSpec = latestSafeVersion
              if (newSpec !== currentSpec) {
                updatesToApply.set(name, { newSpec, type })
                console.log(`     -> 正確指定を安全版 ${newSpec} に自動修正します。`)
              }
            } else {
              console.log('     -> 安全な代替バージョンが存在しないため自動修正できません。')
            }
          } else {
            // 既存の node_modules / lockfile 状況を確認して spec を保持できるか判定
            let installedVersion: string | undefined
            // 修正モードでも何も修正がない場合はメッセージを出す
            const installedPkgPath = path.join(process.cwd(), 'node_modules', name, 'package.json')
            if (fsSync.existsSync(installedPkgPath)) {
              const installedPkg = JSON.parse(fsSync.readFileSync(installedPkgPath, 'utf-8'))
              installedVersion = installedPkg.version
            }
            const lockFileExists = fsSync.existsSync(path.join(process.cwd(), 'package-lock.json'))

            const canKeepSpec = Boolean(
              installedVersion && installedVersion === latestSafeVersion && lockFileExists
            )

            if (canKeepSpec) {
              console.log(
                `     -> Keeping spec "${currentSpec}" (locked safe ${installedVersion}).`
              )
            } else {
              // caret / tilde / range の場合は安全版へ厳密ピン留め
              const newSpec = latestSafeVersion
              if (newSpec !== currentSpec) {
                updatesToApply.set(name, { newSpec, type })
                console.log('     -> Will pin to safe version to avoid future ETARGET.')
              }
            }
          }
        }
      } else {
        console.log('     -> No safe versions available.')
      }
    } else {
      console.log(`  ✅ ${name}@${targetVersion} (satisfies "${versionRange}") is safe.`)
    }
  }

  console.log('\nAudit finished.')
  if (quarantinedCount > 0) {
    console.log(
      `\nFound ${quarantinedCount} quarantined package(s). These may cause 'ETARGET' errors on 'npm install'.`
    )
  } else if (!isFixMode) { // 通常のauditで問題ない場合のみメッセージを表示
    console.log('\nAll dependencies are safe under the current quarantine policy.')
  }

  if (isFixMode) {
    await applyFixes(updatesToApply, process.cwd())
  }
}

// Vitest 実行時は自動起動せず (テスト側から明示呼び出し)
if (!process.env.VITEST) {
  runAudit()
}
