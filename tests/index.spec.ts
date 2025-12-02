import { describe, it, expect, vi } from 'vitest'

// This test runs index in a child process-like manner by mocking process args/env.
// We only assert that invalid policy triggers exit(1).

describe('index config validation', () => {
  it('exits with code 1 on invalid QUARANTINE_POLICY_ON_NO_SAFE', async () => {
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => { throw new Error(String(code)) }) as any)
    // simulate invalid policy before module import
    process.env.QUARANTINE_POLICY_ON_NO_SAFE = 'invalid-policy'
    try {
      await import('../src/index')
    } catch (e) {
      expect(String(e)).toContain('1')
    } finally {
      delete process.env.QUARANTINE_POLICY_ON_NO_SAFE
      mockExit.mockRestore()
    }
  })
})
