export const createLogger = (format: 'text' | 'ndjson') => {
  const output = (
    level: 'info' | 'error',
    event: string,
    meta: Record<string, any>
  ) => {
    const stream = level === 'error' ? console.error : console.log
    
    if (format === 'ndjson') {
      stream(JSON.stringify({ level, event, ...meta }))
      return
    }

    // "key=value" 形式に展開 (undefinedなどは空文字扱い)
    const details = Object.entries(meta)
      .map(([k, v]) => `${k}=${v ?? ''}`)
      .join(' ')
    
    stream(`[${level.toUpperCase()}] [${event}] ${details}`)
  }

  return {
    info: (event: string, meta: Record<string, any> = {}) => output('info', event, meta),
    error: (event: string, meta: Record<string, any> = {}) => output('error', event, meta),
  }
}
