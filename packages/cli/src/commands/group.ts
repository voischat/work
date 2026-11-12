import type { CAC } from 'cac'
import * as api from '../api/group.js'
import { getClient } from '../client.js'
import { isBoolString } from '../utils/isBoolString.js'
import { printError, printSuccess } from '../utils/output.js'
import { parseNumberArray, parseOptionalNumber, parseOptionalString, parseString } from '../utils/args.js'
import { resolveClientOptions } from './_shared.js'

function parseBurstMode(v: unknown): 0 | 1 | undefined {
  const b = isBoolString(v)
  if (b === undefined)
    return undefined
  return b ? 1 : 0
}

export function registerGroupCommands(cli: CAC): void {
  cli
    .command('group:list', 'List groups you manage')
    .option('--page <page>', 'Page number (0-based)', { default: '0' })
    .option('--size <size>', 'Page size', { default: '20' })
    .example('weila-work-cli group:list --page 0 --size 20')
    .action(async (options) => {
      try {
        const page = options.page
        const size = options.size
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getMyManageGroupList(client, {
          page: parseOptionalNumber(page) ?? 0,
          size: parseOptionalNumber(size) ?? 20,
        })
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('group:get', 'Get a group by ID')
    .option('--id <id>', 'Group ID')
    .example('weila-work-cli group:get --id 123')
    .action(async (options) => {
      try {
        const id = options.id
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getGroup(client, Number(id) || 0)
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('group:members', 'List all members of a group')
    .option('--id <id>', 'Group ID')
    .example('weila-work-cli group:members --id 123')
    .action(async (options) => {
      try {
        const id = options.id
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getGroupAllMember(client, Number(id) || 0)
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('group:member-list', 'Paginated group member list')
    .option('--id <id>', 'Group ID')
    .option('--page <page>', 'Page number (0-based)', { default: '0' })
    .option('--size <size>', 'Page size', { default: '20' })
    .example('weila-work-cli group:member-list --id 123 --page 0 --size 20')
    .action(async (options) => {
      try {
        const id = options.id
        const page = options.page
        const size = options.size
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getGroupMemberList(client, Number(id) || 0, {
          page: parseOptionalNumber(page) ?? 0,
          size: parseOptionalNumber(size) ?? 20,
        })
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('group:create', 'Create a group')
    .option('--name <name>', 'Group name')
    .option('--dept-id <id>', 'Department ID')
    .option('--burst-mode <mode>', 'Burst mode: 0 or 1')
    .option('--avatar <url>', 'Avatar URL')
    .example('weila-work-cli group:create --name "Ops" --burst-mode 1')
    .action(async (options) => {
      try {
        const name = parseString(options.name)
        const deptId = options.deptId
        const burstMode = options.burstMode
        const avatar = parseOptionalString(options.avatar)
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.createGroup(client, {
          name,
          dept_id: parseOptionalNumber(deptId),
          burst_mode: parseBurstMode(burstMode),
          avatar,
        })
        printSuccess({ message: 'Group created' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('group:change', 'Update a group')
    .option('--id <id>', 'Group ID')
    .option('--name <name>', 'Group name')
    .option('--burst-mode <mode>', 'Burst mode: 0 or 1')
    .option('--avatar <url>', 'Avatar URL')
    .example('weila-work-cli group:change --id 123 --name "New Name"')
    .action(async (options) => {
      try {
        const id = options.id
        const name = parseOptionalString(options.name)
        const burstMode = options.burstMode
        const avatar = parseOptionalString(options.avatar)
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.changeGroup(client, {
          group_id: Number(id) || 0,
          name,
          burst_mode: parseBurstMode(burstMode),
          avatar,
        })
        printSuccess({ message: 'Group updated' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('group:delete', 'Delete a group')
    .option('--id <id>', 'Group ID')
    .example('weila-work-cli group:delete --id 123')
    .action(async (options) => {
      try {
        const id = options.id
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.deleteGroup(client, { group_id: Number(id) || 0 })
        printSuccess({ message: 'Group deleted' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('group:members-add', 'Add members to a group')
    .option('--id <id>', 'Group ID')
    .option('--user-ids <ids>', 'User IDs (comma separated)')
    .example('weila-work-cli group:members-add --id 123 --user-ids 1,2,3')
    .action(async (options) => {
      try {
        const id = options.id
        const userIds = options.userIds
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.addGroupMembers(client, {
          group_id: Number(id) || 0,
          user_ids: parseNumberArray(userIds),
        })
        printSuccess({ message: 'Members added to group' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('group:member-delete', 'Remove a member from a group')
    .option('--id <id>', 'Group ID')
    .option('--user-id <userId>', 'User ID')
    .example('weila-work-cli group:member-delete --id 123 --user-id 456')
    .action(async (options) => {
      try {
        const id = options.id
        const userId = options.userId
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.deleteGroupMember(client, {
          group_id: Number(id) || 0,
          user_id: Number(userId) || 0,
        })
        printSuccess({ message: 'Member removed from group' })
      }
      catch (err) {
        printError(err)
      }
    })
}
