import { describe, it, expect } from 'vitest'
import { applyPolicy } from '../src/utils/policy'
import type { NpmPackageMeta } from '../src/types/npm'

function createMeta(latest: string, minutesAgo: number, now: Date): NpmPackageMeta {
  return {
    'dist-tags': { latest },
    time: { [latest]: new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString() }
  }
}

describe('applyPolicy', () => {
  const now = new Date('2025-12-01T12:00:00Z')

  it('blocked=false when latest exceeds threshold', () => {
    const meta = createMeta('1.0.0', 500, now)
    const r = applyPolicy(meta, now, 60, 'set-safe')
    expect(r.blocked).toBe(false)
  })

  it('blocked=true with reason for fail policy when no safe version', () => {
    const meta: NpmPackageMeta = {
      'dist-tags': { latest: '2.0.0' },
      time: {
        '1.0.0': now.toISOString(),
        '2.0.0': now.toISOString()
      }
    }
    const r = applyPolicy(meta, now, 60, 'fail')
    expect(r.blocked).toBe(true)
    expect(r.reason).toMatch(/No safe versions|policy/i)
  })
})
