import { describe, it, expect } from 'vitest'
import { parseBool, ensureNonNegativeInt } from '../src/utils/args'

describe('utils/args.parseBool', () => {
  it('真偽値の文字列表現を正しく解釈する', () => {
    expect(parseBool('true', false)).toBe(true)
    expect(parseBool('yes', false)).toBe(true)
    expect(parseBool('on', false)).toBe(true)
  })
  it('偽の文字列表現を正しく解釈する', () => {
    expect(parseBool('false', true)).toBe(false)
    expect(parseBool('no', true)).toBe(false)
    expect(parseBool('off', true)).toBe(false)
  })
  it('数値の1/0は解釈しない', () => {
    expect(parseBool('1', false)).toBe(false)
    expect(parseBool('0', true)).toBe(true)
  })
  it('undefinedの場合はフォールバック値を返す', () => {
    expect(parseBool(undefined, true)).toBe(true)
    expect(parseBool(undefined, false)).toBe(false)
  })
})

describe('utils/args.ensureNonNegativeInt', () => {
  it('正の数は整数に丸める', () => {
    expect(ensureNonNegativeInt(3.7)).toBe(3)
  })
  it('負の数は0を返す', () => {
    expect(ensureNonNegativeInt(-5)).toBe(0)
  })
  it('非有限数は0を返す', () => {
    expect(ensureNonNegativeInt(NaN as any)).toBe(0)
    expect(ensureNonNegativeInt(Infinity)).toBe(0)
  })
})
