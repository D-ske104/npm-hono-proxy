import { getArg } from '../config'
import { emitLog } from './log'
import type { LogLevel, LogFormat } from './log'

const DEFAULT_UPSTREAM = 'https://registry.npmjs.org'

export function getUpstreamBase(level: LogLevel = 'info', format: LogFormat = 'text'): string {
  const raw = getArg('upstream') ?? process.env.UPSTREAM ?? DEFAULT_UPSTREAM
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Invalid UPSTREAM URL: ${raw}`)
  }
  if (url.protocol !== 'https:') {
    // 強制的に https に切り替える
    url.protocol = 'https:'
  }
  if (url.host !== 'registry.npmjs.org') {
    emitLog(level, format, 'warn', 'non-official-upstream', { upstream: url.toString() })
  }
  return url.toString()
}
