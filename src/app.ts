import { Hono } from 'hono'
import type { AppConfig } from './config'
import { handlePackageMetadata } from './handlers/package-metadata'
import { handlePackageVersion } from './handlers/package-version'

export { type AppConfig } from './config'

export function createApp(config: AppConfig) {
  // quarantineMinutes の下限バリデーション（負値 / NaN => 0、少数は切り捨て）
  const safeMinutes = (Number.isFinite(config.quarantineMinutes) && config.quarantineMinutes >= 0)
    ? Math.floor(config.quarantineMinutes)
    : 0
  const app = new Hono()

  // バージョン指定エンドポイント: 明示バージョン取得 + 隔離ロジック
  // unscoped
  app.get('/:pkg/:version', (c) => handlePackageVersion(c, config, safeMinutes))
  // scoped (@scope/package)
  app.get('/@:scope/:pkg/:version', (c) => handlePackageVersion(c, config, safeMinutes))

  // パッケージメタデータ（dist-tags / versions 一覧）
  app.get('/*', (c) => handlePackageMetadata(c, config, safeMinutes))

  return app
}
