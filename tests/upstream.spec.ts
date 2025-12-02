import { describe, it, expect, vi } from 'vitest'
import { fetchUpstream } from '../src/upstream'
import { getUpstreamBase } from '../src/utils/upstream'

describe('fetchUpstream', () => {
  it('constructs URL with base and path', async () => {
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
  it('forces https protocol when http provided', () => {
    const url = getUpstreamBase('warn', 'text')
    expect(url.startsWith('https://')).toBe(true)
  })
  it('throws for invalid URL', () => {
    const original = process.env.UPSTREAM
    process.env.UPSTREAM = 'not-a-url'
    expect(() => getUpstreamBase('warn', 'text')).toThrow()
    process.env.UPSTREAM = original
  })
})
