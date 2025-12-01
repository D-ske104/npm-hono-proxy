import type { Context } from 'hono'
import type { LogLevel, LogFormat } from './log'
import { emitLog } from './log'

export function isJsonResponse(contentType: string | null): boolean {
  return !!contentType && contentType.includes('application/json')
}

export function handleRedirect(c: Context, path: string, upstreamUrl: string, logLevel: LogLevel, logFormat: LogFormat) {
  emitLog(logLevel, logFormat, 'info', 'redirect', { path, upstream: upstreamUrl })
  return c.redirect(upstreamUrl, 302)
}
