export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogLevelSetting = LogLevel | 'silent'

export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

let currentLevel: LogLevelSetting = 'silent'

function isEnabled(level: LogLevel): boolean {
  if (currentLevel === 'silent') return false

  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel]
}

function emit(module: string, level: LogLevel, message: string, args: unknown[]): void {
  if (!isEnabled(level)) return

  if (typeof console === 'undefined') return

  const output = level === 'warn' ? console.warn : level === 'error' ? console.error : console.log
  output.call(console, `[${module}] ${message}`, ...args)
}

export function setLogLevel(level: LogLevelSetting): void {
  currentLevel = level
}

export function getLogLevel(): LogLevelSetting {
  return currentLevel
}

export function createLogger(module: string): Logger {
  return {
    debug: (message, ...args) => emit(module, 'debug', message, args),
    info: (message, ...args) => emit(module, 'info', message, args),
    warn: (message, ...args) => emit(module, 'warn', message, args),
    error: (message, ...args) => emit(module, 'error', message, args),
  }
}
