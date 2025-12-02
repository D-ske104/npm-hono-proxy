import { describe, it, expect } from 'vitest'
import { shouldLog } from '../src/utils/log'

describe('utils/log.shouldLog', () => {
  it('warn level should log info (current >= threshold)', () => {
    expect(shouldLog('warn', 'info')).toBe(true)
  })
  it('info level should not log warn', () => {
    expect(shouldLog('info', 'warn')).toBe(false)
  })
  it('silent never logs', () => {
    expect(shouldLog('silent', 'info')).toBe(false)
    expect(shouldLog('silent', 'warn')).toBe(false)
    expect(shouldLog('silent', 'error')).toBe(false)
  })
})
