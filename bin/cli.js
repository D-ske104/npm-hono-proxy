#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// distの出力をこのCLIファイルの場所を基準に解決
const thisDir = dirname(fileURLToPath(import.meta.url))

// サブコマンドをチェック
const command = process.argv[2]

if (command === 'audit') {
  // 'fix' 引数をグローバル変数として設定し、動的インポート先でアクセス可能にする
  process.env.NPM_HONO_PROXY_AUDIT_FIX = process.argv[3] === 'fix' ? 'true' : 'false'
  const entry = resolve(thisDir, '..', 'dist', 'audit.mjs')
  const entryUrl = pathToFileURL(entry).href
  import(entryUrl)
} else {
  const entry = resolve(thisDir, '..', 'dist', 'index.mjs')
  const entryUrl = pathToFileURL(entry).href
  import(entryUrl)
}
