import { describe, it, expect } from 'vitest'
import { isNpmPackageMeta } from '../src/validate'

describe('isNpmPackageMeta', () => {
  it('accepts object with dist-tags and time maps', () => {
    const obj = { 'dist-tags': { latest: '1.0.0' }, time: { '1.0.0': new Date().toISOString() } }
    expect(isNpmPackageMeta(obj)).toBe(true)
  })

  it('accepts object with missing optional fields', () => {
    expect(isNpmPackageMeta({})).toBe(true)
  })

  it('rejects non-object', () => {
    expect(isNpmPackageMeta(null)).toBe(false)
    expect(isNpmPackageMeta('string')).toBe(false)
  })

  it('rejects if dist-tags is not object', () => {
    expect(isNpmPackageMeta({ 'dist-tags': 123 })).toBe(false)
  })
})
