import { describe, it, expect } from 'vitest'
import { isNpmPackageMeta } from '../src/validate'

describe('isNpmPackageMeta', () => {
  it('dist-tagsとtimeマップを持つオブジェクトを受け入れる', () => {
    const obj = { 'dist-tags': { latest: '1.0.0' }, time: { '1.0.0': new Date().toISOString() } }
    expect(isNpmPackageMeta(obj)).toBe(true)
  })

  it('オプショナルなフィールドが欠けているオブジェクトを受け入れる', () => {
    expect(isNpmPackageMeta({})).toBe(true)
  })

  it('オブジェクトでないものを拒否する', () => {
    expect(isNpmPackageMeta(null)).toBe(false)
    expect(isNpmPackageMeta('string')).toBe(false)
  })

  it('dist-tagsがオブジェクトでない場合、拒否する', () => {
    expect(isNpmPackageMeta({ 'dist-tags': 123 })).toBe(false)
  })
})
