import type { NpmPackageMeta } from './types/npm'

export function isNpmPackageMeta(x: unknown): x is NpmPackageMeta {
  if (typeof x !== 'object' || x === null) return false
  const obj = x as Record<string, unknown>
  const distTags = obj['dist-tags']
  const time = obj['time']
  const distTagsOk =
    distTags === undefined || (typeof distTags === 'object' && distTags !== null)
  const timeOk = time === undefined || (typeof time === 'object' && time !== null)
  return distTagsOk && timeOk
}
