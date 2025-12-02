import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// 上流 (npm レジストリ) への fetch をモックし、制御されたテスト用メタデータを返す
vi.mock('../src/upstream', () => {
  return {
    fetchUpstream: async () => {
      // 全テストで同じパッケージ名/バージョン集合を利用
      const now = Date.now()
      const minutes = (m: number) => new Date(now - m * 60_000).toISOString()
      const meta = {
        versions: {
          '1.0.0': {},
          '1.0.1': {},
        },
        time: {
          '1.0.0': minutes(120), // 古い=安全
          '1.0.1': minutes(5),   // 直近=検疫対象
        },
      }
      return { res: { ok: true, json: async () => meta } }
    },
  }
})

// テスト出力を読みやすくするためログを抑制 (一部メッセージはコンソールに出ない)
const originalLog = console.log
const originalWarn = console.warn

import { runAudit } from '../src/audit'

describe('audit コマンドロジック', () => {
  let cwdBackup: string
  let tmpDir: string

  beforeEach(async () => {
    process.env.VITEST = 'true'
    process.env.QUARANTINE_MINUTES = '30' // 検疫時間窓=30分 (直近リリースを検疫対象にする)
    cwdBackup = process.cwd()
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-test-'))
    process.chdir(tmpDir)
    console.log = (..._args: any[]) => {}
    console.warn = (..._args: any[]) => {}
  })

  afterEach(async () => {
    process.chdir(cwdBackup)
    delete process.env.VITEST
    delete process.env.NPM_HONO_PROXY_AUDIT_FIX
    delete process.env.QUARANTINE_MINUTES
    console.log = originalLog
    console.warn = originalWarn
    // cleanup temp dir best-effort
    try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
  })

  // テスト用 package.json を書き込むユーティリティ
  async function writePkg(depSpec: string) {
    await fs.writeFile(path.join(process.cwd(), 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0', dependencies: { pkg: depSpec } }, null, 2))
  }

  // 現在の依存バージョン指定文字列を取得
  async function readPkgSpec(): Promise<string> {
    const raw = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
    return JSON.parse(raw).dependencies.pkg as string
  }

  it('lockfile・インストール無しで解決バージョンが検疫対象なら安全版へ厳密固定 (prefixは除去)', async () => {
    await writePkg('^1.0.0')
    process.env.NPM_HONO_PROXY_AUDIT_FIX = 'true'
    await runAudit()
    const spec = await readPkgSpec()
    expect(spec).toBe('1.0.0') // 厳密固定
  })

  it('安全版がインストール済みかつ lockfile があれば範囲指定を保持する', async () => {
    await writePkg('^1.0.0')
    // simulate installed safe version 1.0.0
    const nmPkgDir = path.join(process.cwd(), 'node_modules', 'pkg')
    fsSync.mkdirSync(nmPkgDir, { recursive: true })
    await fs.writeFile(path.join(nmPkgDir, 'package.json'), JSON.stringify({ name: 'pkg', version: '1.0.0' }))
    // simulate lockfile
    await fs.writeFile(path.join(process.cwd(), 'package-lock.json'), JSON.stringify({ dependencies: { pkg: { version: '1.0.0' } } }))

    process.env.NPM_HONO_PROXY_AUDIT_FIX = 'true'
    await runAudit()
    const spec = await readPkgSpec()
    expect(spec).toBe('^1.0.0') // kept
  })

  it('厳密指定が検疫対象なら安全版へ自動修正 (prefixは付与しない)', async () => {
    await writePkg('1.0.1') // 検疫対象の正確指定
    process.env.NPM_HONO_PROXY_AUDIT_FIX = 'true'
    await runAudit()
    const spec = await readPkgSpec()
    expect(spec).toBe('1.0.0') // 安全版へ変更(そのまま厳密指定)
  })

  it('安全な厳密指定は変更されない', async () => {
    await writePkg('1.0.0')
    process.env.NPM_HONO_PROXY_AUDIT_FIX = 'true'
    await runAudit()
    const spec = await readPkgSpec()
    expect(spec).toBe('1.0.0')
  })
})
