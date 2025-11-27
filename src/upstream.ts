const DEFAULT_UPSTREAM = 'https://registry.npmjs.org'

export async function fetchUpstream(path: string, base = DEFAULT_UPSTREAM) {
  const upstreamUrl = new URL(path, base)
  const res = await fetch(upstreamUrl.toString())
  const contentType = res.headers.get('content-type')
  return { res, contentType }
}
