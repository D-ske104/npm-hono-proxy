export function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(prefix)) return a.slice(prefix.length)
  }
  return undefined
}

export function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback
  const t = v.toLowerCase()
  if (["1", "true", "yes", "on"].includes(t)) return true
  if (["0", "false", "no", "off"].includes(t)) return false
  return fallback
}
