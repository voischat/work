import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger, getLogLevel, setLogLevel } from './weila_log'

describe('weila log', () => {
  const log = createLogger('CORE:test')

  beforeEach(() => {
    setLogLevel('silent')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    setLogLevel('silent')
    vi.restoreAllMocks()
  })

  it('stays silent by default', () => {
    expect(getLogLevel()).toBe('silent')
    log.error('hidden')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('drops levels below the configured one', () => {
    setLogLevel('warn')
    log.info('hidden')
    log.warn('shown')
    log.error('shown too')
    expect(console.log).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith('[CORE:test] shown')
    expect(console.error).toHaveBeenCalledWith('[CORE:test] shown too')
  })

  it('writes debug and info through console.log', () => {
    setLogLevel('debug')
    log.debug('debug line', 1)
    log.info('info line')
    expect(console.log).toHaveBeenNthCalledWith(1, '[CORE:test] debug line', 1)
    expect(console.log).toHaveBeenNthCalledWith(2, '[CORE:test] info line')
  })

  it('keeps one module prefix per logger', () => {
    setLogLevel('info')
    createLogger('DB:core').info('db line')
    expect(console.log).toHaveBeenCalledWith('[DB:core] db line')
  })
})
