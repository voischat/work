import type { CAC } from 'cac'
import md5 from 'md5'
import * as api from '../api/address.js'
import { getClient } from '../client.js'
import { isBoolString } from '../utils/isBoolString.js'
import { printError, printSuccess } from '../utils/output.js'
import { parseNumberArray, parseOptionalNumber, parseOptionalString, parseString } from '../utils/args.js'
import { resolveClientOptions } from './_shared.js'

function boolToNum(v: unknown): 0 | 1 | undefined {
  const b = isBoolString(v)
  if (b === undefined)
    return undefined
  return b ? 1 : 0
}

export function registerAddressCommands(cli: CAC): void {
  cli
    .command('address:dept-list', 'List managed departments')
    .option('--dept-id <id>', 'Scope to a specific department')
    .example('weila-work-cli address:dept-list')
    .action(async (options) => {
      try {
        const deptId = options.deptId
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getMyManageDeptList(client, parseOptionalNumber(deptId))
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:dept-all', 'List all departments (flat)')
    .example('weila-work-cli address:dept-all')
    .action(async (options) => {
      try {
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getMyManageAllDept(client)
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:dept-tree', 'List all departments for tree widgets')
    .example('weila-work-cli address:dept-tree')
    .action(async (options) => {
      try {
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getAllDept(client)
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:member-list', 'Paginated member list across organization')
    .option('--key <key>', 'Search keyword')
    .option('--member-types <types>', 'Member types (comma separated)')
    .option('--dept-ids <ids>', 'Department IDs (comma separated)')
    .option('--page <page>', 'Page number (0-based)', { default: '0' })
    .option('--size <size>', 'Page size', { default: '20' })
    .example('weila-work-cli address:member-list --key zhang --dept-ids 1,2')
    .action(async (options) => {
      try {
        const key = parseOptionalString(options.key)
        const memberTypes = options.memberTypes
        const deptIds = options.deptIds
        const page = options.page
        const size = options.size
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getMemberList(client, {
          key,
          member_types: parseNumberArray(memberTypes),
          dept_ids: parseNumberArray(deptIds),
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
    .command('address:dept-member-list', 'Paginated members of a department')
    .option('--dept-id <id>', 'Department ID')
    .option('--key <key>', 'Search keyword')
    .option('--member-types <types>', 'Member types (comma separated)')
    .option('--page <page>', 'Page number (0-based)', { default: '0' })
    .option('--size <size>', 'Page size', { default: '20' })
    .example('weila-work-cli address:dept-member-list --dept-id 5')
    .action(async (options) => {
      try {
        const deptId = options.deptId
        const key = parseOptionalString(options.key)
        const memberTypes = options.memberTypes
        const page = options.page
        const size = options.size
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getDeptMemberList(client, Number(deptId) || 0, {
          key,
          member_types: parseNumberArray(memberTypes),
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
    .command('address:dept-members', 'Get all members of a department')
    .option('--dept-id <id>', 'Department ID')
    .example('weila-work-cli address:dept-members --dept-id 5')
    .action(async (options) => {
      try {
        const deptId = options.deptId
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getDeptAllMember(client, Number(deptId) || 0)
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:member', 'Get a single member')
    .option('--id <id>', 'Member ID')
    .example('weila-work-cli address:member --id 123')
    .action(async (options) => {
      try {
        const id = options.id
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.getMember(client, Number(id) || 0)
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:member-create', 'Create a new organization member')
    .option('--name <name>', 'Member name')
    .option('--phone <phone>', 'Phone number')
    .option('--password <password>', 'Password (plain text; will be MD5 hashed)')
    .option('--md5', 'Password is already MD5 hashed')
    .option('--job-num <num>', 'Job number')
    .option('--dept-id <id>', 'Department ID')
    .option('--sex <sex>', 'Sex: 0 female, 1 male')
    .option('--avatar <url>', 'Avatar URL')
    .option('--is-dept-admin <enabled>', 'Is department admin (true/false/0/1)')
    .option('--loc-share <enabled>', 'Location sharing (true/false/0/1)')
    .option('--track <enabled>', 'Track enabled (true/false/0/1)')
    .example('weila-work-cli address:member-create --name "John" --password 123456 --dept-id 5')
    .action(async (options) => {
      try {
        const name = parseString(options.name)
        const phone = parseOptionalString(options.phone)
        const password = parseString(options.password)
        const jobNum = parseOptionalString(options.jobNum)
        const deptId = options.deptId
        const sex = options.sex
        const avatar = parseOptionalString(options.avatar)
        const isDeptAdmin = options.isDeptAdmin
        const locShare = options.locShare
        const track = options.track
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.createMember(client, {
          name,
          phone,
          password: options.md5 ? password : md5(password),
          job_num: jobNum,
          dept_id: parseOptionalNumber(deptId),
          sex: parseOptionalNumber(sex),
          avatar,
          is_dept_admin: boolToNum(isDeptAdmin),
          loc_share: boolToNum(locShare),
          track: boolToNum(track),
        })
        printSuccess({ message: 'Member created' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:member-change', 'Update an existing member')
    .option('--user-id <id>', 'Member user ID')
    .option('--name <name>', 'Member name')
    .option('--job-num <num>', 'Job number')
    .option('--dept-id <id>', 'Department ID')
    .option('--sex <sex>', 'Sex: 0 female, 1 male')
    .option('--avatar <url>', 'Avatar URL')
    .option('--phone <phone>', 'Phone number')
    .option('--is-dept-admin <enabled>', 'Is department admin (true/false/0/1)')
    .option('--loc-share <enabled>', 'Location sharing (true/false/0/1)')
    .option('--track <enabled>', 'Track enabled (true/false/0/1)')
    .example('weila-work-cli address:member-change --user-id 123 --name "New Name"')
    .action(async (options) => {
      try {
        const userId = options.userId
        const name = parseOptionalString(options.name)
        const jobNum = parseOptionalString(options.jobNum)
        const deptId = options.deptId
        const sex = options.sex
        const avatar = parseOptionalString(options.avatar)
        const phone = parseOptionalString(options.phone)
        const isDeptAdmin = options.isDeptAdmin
        const locShare = options.locShare
        const track = options.track
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.changeMember(client, {
          user_id: Number(userId) || 0,
          name,
          job_num: jobNum,
          dept_id: parseOptionalNumber(deptId),
          sex: parseOptionalNumber(sex),
          avatar,
          phone,
          is_dept_admin: boolToNum(isDeptAdmin),
          loc_share: boolToNum(locShare),
          track: boolToNum(track),
        })
        printSuccess({ message: 'Member updated' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:member-state', 'Enable or disable a member account')
    .option('--user-id <id>', 'Member user ID')
    .option('--state <state>', 'State: 0 disabled, 1 enabled')
    .example('weila-work-cli address:member-state --user-id 123 --state 1')
    .action(async (options) => {
      try {
        const userId = options.userId
        const state = options.state
        const { api: client } = await getClient(resolveClientOptions(options))
        const res = await api.changeMemberState(client, { user_id: Number(userId) || 0, state: Number(state) as 0 | 1 })
        printSuccess(res)
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:member-delete', 'Delete a member')
    .option('--user-id <id>', 'Member user ID')
    .example('weila-work-cli address:member-delete --user-id 123')
    .action(async (options) => {
      try {
        const userId = options.userId
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.deleteMember(client, { user_id: Number(userId) || 0 })
        printSuccess({ message: 'Member deleted' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:dept-members-add', 'Add existing members to a department')
    .option('--dept-id <id>', 'Department ID')
    .option('--user-ids <ids>', 'User IDs (comma separated)')
    .example('weila-work-cli address:dept-members-add --dept-id 5 --user-ids 1,2,3')
    .action(async (options) => {
      try {
        const deptId = options.deptId
        const userIds = options.userIds
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.addDeptMembers(client, {
          dept_id: Number(deptId) || 0,
          user_ids: parseNumberArray(userIds),
        })
        printSuccess({ message: 'Members added to department' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:dept-create', 'Create a department')
    .option('--name <name>', 'Department name')
    .example('weila-work-cli address:dept-create --name "Sales"')
    .action(async (options) => {
      try {
        const name = parseString(options.name)
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.createDept(client, { name })
        printSuccess({ message: 'Department created' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:dept-change', 'Rename a department')
    .option('--dept-id <id>', 'Department ID')
    .option('--name <name>', 'New name')
    .example('weila-work-cli address:dept-change --dept-id 5 --name "New Name"')
    .action(async (options) => {
      try {
        const deptId = options.deptId
        const name = parseString(options.name)
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.changeDept(client, { dept_id: Number(deptId) || 0, name })
        printSuccess({ message: 'Department updated' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:dept-delete', 'Delete a department')
    .option('--dept-id <id>', 'Department ID')
    .example('weila-work-cli address:dept-delete --dept-id 5')
    .action(async (options) => {
      try {
        const deptId = options.deptId
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.deleteDept(client, { dept_id: Number(deptId) || 0 })
        printSuccess({ message: 'Department deleted' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:device-add', 'Add a device member')
    .option('--name <name>', 'Device name')
    .option('--verifycode <code>', 'Device verify code')
    .option('--job-num <num>', 'Job number')
    .option('--dept-id <id>', 'Department ID')
    .option('--sex <sex>', 'Sex')
    .option('--avatar <url>', 'Avatar URL')
    .option('--phone <phone>', 'Phone number')
    .option('--loc-share <enabled>', 'Location sharing (true/false/0/1)')
    .option('--track <enabled>', 'Track enabled (true/false/0/1)')
    .example('weila-work-cli address:device-add --name "Device 1" --verifycode xxx')
    .action(async (options) => {
      try {
        const name = parseString(options.name)
        const verifycode = parseString(options.verifycode)
        const jobNum = parseOptionalString(options.jobNum)
        const deptId = options.deptId
        const sex = options.sex
        const avatar = parseOptionalString(options.avatar)
        const phone = parseOptionalString(options.phone)
        const locShare = options.locShare
        const track = options.track
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.addDevice(client, {
          name,
          verifycode,
          job_num: jobNum,
          dept_id: parseOptionalNumber(deptId),
          sex: parseOptionalNumber(sex),
          avatar,
          phone,
          loc_share: boolToNum(locShare),
          track: boolToNum(track),
        })
        printSuccess({ message: 'Device added' })
      }
      catch (err) {
        printError(err)
      }
    })

  cli
    .command('address:member-reset-password', 'Reset a member password')
    .option('--user-id <id>', 'Member user ID')
    .option('--password <password>', 'New password (plain text; will be MD5 hashed)')
    .option('--md5', 'Password is already MD5 hashed')
    .example('weila-work-cli address:member-reset-password --user-id 123 --password xxx')
    .action(async (options) => {
      try {
        const userId = options.userId
        const password = parseString(options.password)
        const { api: client } = await getClient(resolveClientOptions(options))
        await api.resetMemberPassword(client, {
          user_id: Number(userId) || 0,
          password: options.md5 ? password : md5(password),
        })
        printSuccess({ message: 'Password reset' })
      }
      catch (err) {
        printError(err)
      }
    })
}
