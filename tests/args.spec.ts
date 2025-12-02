import { describe, it, expect } from 'vitest'
import { parseBool, ensureNonNegativeInt } from '../src/utils/args'

describe('utils/args.parseBool', () => {
  it('accepts true variants', () => {
    expect(parseBool('true', false)).toBe(true)
    expect(parseBool('yes', false)).toBe(true)
    expect(parseBool('on', false)).toBe(true)
  })
  it('accepts false variants', () => {
    expect(parseBool('false', true)).toBe(false)
    expect(parseBool('no', true)).toBe(false)
    expect(parseBool('off', true)).toBe(false)
  })
  it('ignores numeric 1/0', () => {
    expect(parseBool('1', false)).toBe(false)
    expect(parseBool('0', true)).toBe(true)
  })
  it('fallback when undefined', () => {
    expect(parseBool(undefined, true)).toBe(true)
    expect(parseBool(undefined, false)).toBe(false)
  })
})

describe('utils/args.ensureNonNegativeInt', () => {
  it('floors positive numbers', () => {
    expect(ensureNonNegativeInt(3.7)).toBe(3)
  })
  it('returns 0 for negatives', () => {
    expect(ensureNonNegativeInt(-5)).toBe(0)
  })
  it('returns 0 for non-finite', () => {
    expect(ensureNonNegativeInt(NaN as any)).toBe(0)
    expect(ensureNonNegativeInt(Infinity)).toBe(0)
  })
})
