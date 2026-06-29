import type { CAC } from 'cac'
import * as api from '../api/org.js'
import { getClient } from '../client.js'
import { printError, printSuccess } from '../utils/output.js'
import { resolveClientOptions } from './_shared.js'
import { parseOptionalString } from '../utils/args.js'

export function registerOrgCommands(cli: CAC): void {
  cli
    .command('org:get', 'Get current organization')
    .alias('org')
    .example('weila-work-cli org:get')
    .action(async (options) => {
      try {
        const { api: client } = await getClient(resolveClientOptions(options))
        const corp = await api.getMyOrg(client)
        printSuccess(corp)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('org:vip', 'Get current organization VIP info')
    .example('weila-work-cli org:vip')
    .action(async (options) => {
      try {
        const { api: client } = await getClient(resolveClientOptions(options))
        const vip = await api.getMyVip(client)
        printSuccess(vip)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('org:create', 'Create an organization')
    .option('--name <name>', 'Organization name', { type: [String] })
    .option('--avatar <url>', 'Avatar URL', { type: [String] })
    .example('weila-work-cli org:create --name "My Org"')
    .action(async (options) => {
      try {
        const name = parseOptionalString(options.name) || ''
        const avatar = parseOptionalString(options.avatar)
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.createOrg(client, { name, avatar: avatar || undefined })
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('org:change', 'Update organization name/avatar')
    .option('--name <name>', 'Organization name', { type: [String] })
    .option('--avatar <url>', 'Avatar URL', { type: [String] })
    .example('weila-work-cli org:change --name "New Name"')
    .action(async (options) => {
      try {
        const name = parseOptionalString(options.name)
        const avatar = parseOptionalString(options.avatar)
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.changeOrg(client, { name, avatar })
        printSuccess({ message: 'Organization updated' })
      }
      catch (err) {
        printError(err)
      }
    })
}
