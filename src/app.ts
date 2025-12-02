import { Hono } from 'hono'
import type { AppConfig } from './config'
import { handlePackageMetadata } from './handlers/package-metadata'
import { handlePackageVersion } from './handlers/package-version'

export { type AppConfig } from './config'

export function createApp(config: AppConfig) {
  // quarantineMinutesの下限バリデーション（負値やNaNを0に補正）
  const safeMinutes = (Number.isFinite(config.quarantineMinutes) && config.quarantineMinutes >= 0)
    ? Math.floor(config.quarantineMinutes)
    : 0
  const app = new Hono()

  app.get('/:pkg/:version', (c) => handlePackageVersion(c, config, safeMinutes))

  app.get('/*', (c) => handlePackageMetadata(c, config, safeMinutes))

  return app
}
