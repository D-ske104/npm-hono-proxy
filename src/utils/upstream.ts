import { getArg } from './args'

const DEFAULT_UPSTREAM = 'https://registry.npmjs.org'

export function getUpstreamBase(): string {
  return getArg('upstream') ?? process.env.UPSTREAM ?? DEFAULT_UPSTREAM
}
