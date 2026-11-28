import { test as base } from '@playwright/test'
import { CoreSession, CoreSessionOptions, readIntegrationEnv } from './harness'

export const integrationEnv = readIntegrationEnv()

const AUDIO_LAUNCH_ARGS = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
]

async function openCoreSession(options: CoreSessionOptions = {}) {
  if (!integrationEnv) throw new Error('Integration environment is not configured')

  const session = await CoreSession.open(integrationEnv, undefined, options)

  try {
    await session.login()
    await session.waitForReady()
    await session.waitForSessions()

    return session
  } catch (error) {
    await session.close()
    throw error
  }
}

export const test = base.extend<{ core: CoreSession; coreAudio: CoreSession }>({
  core: [
    async (_fixtures, use) => {
      const session = await openCoreSession()

      try {
        await use(session)
      } finally {
        await session.close()
      }
    },
    { scope: 'worker' },
  ],
  coreAudio: [
    async (_fixtures, use) => {
      const session = await openCoreSession({ launchArgs: AUDIO_LAUNCH_ARGS })

      try {
        await use(session)
      } finally {
        await session.close()
      }
    },
    { scope: 'worker' },
  ],
})

export { expect } from '@playwright/test'
