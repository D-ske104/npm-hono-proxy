import { describe, it, expect, vi } from 'vitest'
import { fetchUpstream } from '../src/upstream'

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
