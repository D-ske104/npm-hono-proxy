import { serve } from '@hono/node-server'
import { createApp } from './app'
import { getConfig, getArg } from './config'

const config = getConfig()
const PORT = Number(getArg('port') ?? process.env.PORT ?? '4873')

const app = createApp(config)

console.info(`🛡️  Safe NPM Proxy running on http://localhost:${PORT}`)
console.info(
  `    quarantine: enabled=${config.quarantineEnabled}, minutes=${config.quarantineMinutes}, whenNoSafe=${config.quarantinePolicyOnNoSafe}`
)
console.info(`    logging: level=${config.logLevel}, format=${config.logFormat}`)

serve({
  fetch: app.fetch,
  port: PORT,
})
