import { debug, Debugger } from 'debug'

function initLogger(modules: string): void {
  debug.enable(modules + ',-socket-client:*')
}

function getLogger(loggerName: string): Debugger {
  const logger = debug(loggerName)
  logger.log = console.log.bind(console)

  return logger
}

function setLoggerEnabled(_enabled: boolean): void {}

function isLoggerEnabled(): boolean {
  return true
}

export { initLogger, getLogger, setLoggerEnabled, isLoggerEnabled }
