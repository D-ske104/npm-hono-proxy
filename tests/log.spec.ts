import { describe, it, expect } from 'vitest'
import { shouldLog } from '../src/utils/log'

describe('utils/log.shouldLog', () => {
  it('warnレベルはinfoをログに出力すべき (current >= threshold)', () => {
    expect(shouldLog('warn', 'info')).toBe(true)
  })
  it('infoレベルはwarnをログに出力すべきでない', () => {
    expect(shouldLog('info', 'warn')).toBe(false)
  })
  it('silentは何もログに出力しない', () => {
    expect(shouldLog('silent', 'info')).toBe(false)
    expect(shouldLog('silent', 'warn')).toBe(false)
    expect(shouldLog('silent', 'error')).toBe(false)
  })
})
