import type { CAC } from 'cac'
import md5 from 'md5'
import * as api from '../api/auth.js'
import { getClient } from '../client.js'
import { printError, printSuccess } from '../utils/output.js'
import { parseString } from '../utils/args.js'
import { resolveClientOptions } from './_shared.js'

export function registerAuthCommands(cli: CAC): void {
  cli
    .command('auth:login', 'Login with account and password')
    .alias('login')
    .option('--account <account>', 'Account number')
    .option('--password <password>', 'Password (plain text; will be MD5 hashed)')
    .option('--md5', 'Password is already MD5 hashed')
    .example('weila-work-cli auth:login --account 70009790 --password 123456')
    .action(async (options) => {
      try {
        const account = parseString(options.account)
        const password = parseString(options.password)
        const { api: client, storage } = await getClient(resolveClientOptions(options))
        const passwordHash = options.md5 ? password : md5(password)
        const res = await api.loginByPassword(client, { account, password: passwordHash })
        await storage.setItem('token', res.access_token)
        printSuccess({ token: res.access_token, expires_in: res.expires_in, org: res.org })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('auth:whoami', 'Get current user info')
    .alias('whoami')
    .example('weila-work-cli auth:whoami')
    .action(async (options) => {
      try {
        const { api: client } = await getClient(resolveClientOptions(options))
        const self = await api.getSelfInfo(client)
        printSuccess(self)
      }
      catch (err) {
        printError(err)
      }
    })
}
