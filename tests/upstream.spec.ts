import { describe, it, expect, vi } from 'vitest'
import { fetchUpstream } from '../src/upstream'
import { getUpstreamBase } from '../src/utils/upstream'

describe('fetchUpstream', () => {
  it('ベースURLとパスでURLを構築する', async () => {
    const base = 'https://example.com'
    const path = '/lodash'
    const mockRes = new Response('{}', { headers: { 'content-type': 'application/json' } })
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(mockRes)
    const { res, contentType } = await fetchUpstream(path, base)
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/lodash')
    expect(res).toBe(mockRes)
    expect(contentType).toContain('application/json')
    fetchSpy.mockRestore()
  })
})

describe('utils/upstream.getUpstreamBase', () => {
  it('httpが指定された場合、httpsプロトコルを強制する', () => {
    const url = getUpstreamBase('warn', 'text')
    expect(url.startsWith('https://')).toBe(true)
  })
  it('無効なURLの場合、エラーを投げる', () => {
    const original = process.env.UPSTREAM
    process.env.UPSTREAM = 'not-a-url'
    expect(() => getUpstreamBase('warn', 'text')).toThrow()
    process.env.UPSTREAM = original
  })
})
