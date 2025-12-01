export type LogLevel = 'info' | 'warn' | 'error' | 'silent'
export type LogFormat = 'text' | 'ndjson'

export function shouldLog(currentLevel: LogLevel, threshold: LogLevel): boolean {
  const order: Record<LogLevel, number> = { info: 0, warn: 1, error: 2, silent: 99 }
  return order[threshold] >= order[currentLevel] && currentLevel !== 'silent'
}

export function emitLog(
  currentLevel: LogLevel,
  format: LogFormat,
  level: Exclude<LogLevel, 'silent'>,
  event: string,
  meta: Record<string, unknown>,
): void {
  if (!shouldLog(currentLevel, level)) return
  if (format === 'ndjson') {
    const line = JSON.stringify({ level, event, ...meta })
    console.log(line)
  } else {
    const flat = Object.entries(meta)
      .map(([k, v]) => `${k}=${v === undefined ? 'n/a' : String(v)}`)
      .join(' ')
    const msg = `[${event}] ${flat}`
    if (level === 'info') console.info(msg)
    else if (level === 'warn') console.warn(msg)
    else console.error(msg)
  }
}
