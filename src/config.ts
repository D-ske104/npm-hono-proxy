import type { QuarantineNoSafePolicy } from './quarantine'
import type { LogLevel, LogFormat } from './utils/log'

// AppConfigをここに移動
export interface AppConfig {
  quarantineEnabled: boolean
  quarantineMinutes: number
  quarantinePolicyOnNoSafe: QuarantineNoSafePolicy
  logLevel: LogLevel
  logFormat: LogFormat
}

export function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(prefix)) return a.slice(prefix.length)
  }
  return undefined
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback
  const t = v.toLowerCase()
  if (["true", "yes", "on"].includes(t)) return true
  if (["false", "no", "off"].includes(t)) return false
  return fallback
}

function ensureNonNegativeInt(v: number): number {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  return Math.floor(v)
}

export function getConfig(): AppConfig {
  const quarantineEnabled = parseBool(getArg('quarantine-enabled') ?? process.env.QUARANTINE_ENABLED, true)

  const rawQuarantineMinutes = Number(
    getArg('quarantine-minutes') ??
      process.env.QUARANTINE_MINUTES ??
      String(21 * 24 * 60) // 既定は 21 日
  )
  const quarantineMinutes = ensureNonNegativeInt(rawQuarantineMinutes)
  if (quarantineMinutes !== rawQuarantineMinutes) {
    console.warn(
      `⚠️  QUARANTINE_MINUTES (${rawQuarantineMinutes}) is invalid and has been corrected to ${quarantineMinutes}`
    )
  }

  const quarantinePolicyOnNoSafeRaw = (getArg('quarantine-policy-on-no-safe') ?? process.env.QUARANTINE_POLICY_ON_NO_SAFE ?? 'set-safe')
  if (quarantinePolicyOnNoSafeRaw !== 'set-safe' && quarantinePolicyOnNoSafeRaw !== 'fail') {
    console.error(`Invalid QUARANTINE_POLICY_ON_NO_SAFE: ${quarantinePolicyOnNoSafeRaw}. Allowed: set-safe|fail`)
    process.exit(1)
  }
  const quarantinePolicyOnNoSafe = quarantinePolicyOnNoSafeRaw as QuarantineNoSafePolicy

  const verbose = parseBool(getArg('verbose') ?? process.env.VERBOSE, false)
  const logLevel = (getArg('log-level') ?? process.env.LOG_LEVEL ?? (verbose ? 'info' : 'warn')).toLowerCase() as LogLevel
  const logFormat = (getArg('log-format') ?? process.env.LOG_FORMAT ?? 'text').toLowerCase() as LogFormat

  return {
    quarantineEnabled,
    quarantineMinutes,
    quarantinePolicyOnNoSafe,
    logLevel,
    logFormat,
  }
}
