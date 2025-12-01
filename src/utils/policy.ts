import type { NpmPackageMeta } from '../types/npm'
import { applyQuarantine } from '../quarantine'
import type { QuarantineNoSafePolicy } from '../quarantine'

export type PolicyResult = { blocked: boolean; reason?: string }

export function applyPolicy(
  data: NpmPackageMeta,
  now: Date,
  days: number,
  policy: QuarantineNoSafePolicy,
): PolicyResult {
  try {
    applyQuarantine(data['dist-tags'], data.time, now, days, policy)
    return { blocked: false }
  } catch (e) {
    return { blocked: true, reason: e instanceof Error ? e.message : 'policy-error' }
  }
}
