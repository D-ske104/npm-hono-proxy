import { Hono } from 'hono'
import { filterQuarantinedMetadata } from './helpers/quarantine'
import { createLogger } from './helpers/logger'

// 設定は引数で受け取る（依存性の注入）
export type AppConfig = {
  upstream: string
  quarantineMinutes: number
  logFormat: 'text' | 'ndjson'
}

export function createApp(config: AppConfig) {
  const app = new Hono()
  const log = createLogger(config.logFormat)

  // 全リクエストをハンドリング
  app.get('/*', async (c) => {
    const path = c.req.path
    const upstreamUrl = `${config.upstream}${path}`

    try {
      // 1. 上流へリクエスト
      const res = await fetch(upstreamUrl)
      
      // エラー、またはJSON以外 (tarballなど) はそのまま流すかリダイレクト
      const contentType = res.headers.get('content-type')
      if (!res.ok || !contentType?.includes('application/json')) {
        // リダイレクトの方が帯域負荷が低く、npm clientの挙動としても自然
        log.info('redirect', { path, target: res.url, status: 302 })
        return c.redirect(res.url, 302)
      }

      // 2. メタデータJSONを取得
      const data = await res.json() as any

      // 3. パッケージメタデータ形式なら検疫ロジックを通す
      // (dist-tags と time があるものをパッケージ情報とみなす簡易判定)
      if (data && data['dist-tags'] && data.time) {
        const { filteredData, latestModified } = filterQuarantinedMetadata(data, config.quarantineMinutes)
        
        if (latestModified) {
          log.info('quarantine', { path, info: `latest changed to ${filteredData['dist-tags']?.latest}` })
        } else {
          log.info('proxy', { path, status: 200 })
        }
        return c.json(filteredData)
      }

      // それ以外のJSON (例: 検索結果など) はそのまま返す
      return c.json(data)

    } catch (e: any) {
      log.error('error', { path, message: e.message })
      return c.text('Internal Server Error', 500)
    }
  })

  return app
}
