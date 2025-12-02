#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// distの出力をこのCLIファイルの場所を基準に解決
const thisDir = dirname(fileURLToPath(import.meta.url))
const entry = resolve(thisDir, '..', 'dist', 'index.js')
const entryUrl = pathToFileURL(entry).href

// ビルドされたESMエントリを動的にインポート
import(entryUrl)
