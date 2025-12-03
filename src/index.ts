import { serve } from '@hono/node-server'
import { getArg } from './helpers/arg'
import { createApp } from './app'

// 設定: 環境変数からシンプルに読み込む (デフォルト値付き)
const PORT = Number(getArg('port') || 4873)
const UPSTREAM = (getArg('upstream') || 'https://registry.npmjs.org').replace(/\/$/, '')
const QUARANTINE_MINUTES = Number(getArg('quarantine-minutes') || 21 * 24 * 60)
const LOG_FORMAT = getArg('log-format') || 'text' // 'text' | 'ndjson'

const app = createApp({
  upstream: UPSTREAM,
  quarantineMinutes: QUARANTINE_MINUTES,
  logFormat: LOG_FORMAT === 'ndjson' ? 'ndjson' : 'text',
})

console.info(`🛡️  Safe NPM Proxy running on http://localhost:${PORT}`)
console.info(`   Upstream: ${UPSTREAM}`)
console.info(`   Quarantine: ${QUARANTINE_MINUTES} minutes`)
console.info(`   Log format: ${LOG_FORMAT}`)
console.info('----------------------------------------')
console.info('使い方の例:')
console.info(`  npm のレジストリを一時的にこのプロキシに変更してインストール`)
console.info(`    npm --registry http://localhost:${PORT} install <package>@<version>`) 
console.info('')
console.info('  現在のプロジェクトのみレジストリを設定してインストール')
console.info(`    npm config set registry http://localhost:${PORT}`)
console.info('    npm install <package>@<version>')
console.info('')
console.info('  動作確認 (curl): 上流からのパッケージメタデータ取得')
console.info(`    curl -s http://localhost:${PORT}/<package> | head`)
console.info('')
console.info('オプション:')
console.info(`  --port <number>               デフォルト ${PORT}`)
console.info(`  --upstream <url>              デフォルト ${UPSTREAM}`)
console.info(`  --quarantine-minutes <num>    デフォルト ${QUARANTINE_MINUTES}`)
console.info(`  --log-format <text|ndjson>    デフォルト ${LOG_FORMAT}`)
console.info('----------------------------------------')

serve({ fetch: app.fetch, port: PORT })
