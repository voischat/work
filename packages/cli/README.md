# weila-work-cli

<p align="center">
  <a href="https://www.npmjs.com/package/weila-work-cli"><img src="https://img.shields.io/npm/v/weila-work-cli?style=flat&colorA=080f12&colorB=1fa669&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/weila-work-cli"><img src="https://img.shields.io/npm/dm/weila-work-cli?style=flat&colorA=080f12&colorB=1fa669&logo=npm" alt="npm downloads"></a>
  <a href="https://github.com/kvoon9/weila-work/blob/main/LICENSE"><img src="https://img.shields.io/github/license/kvoon9/weila-work.svg?style=flat&colorA=080f12&colorB=1fa669&logo=github" alt="License"></a>
</p>

CLI for Weila Work management APIs (auth + org/address/group management).

> Scope: wraps the HTTP endpoints used by `weila-work/packages/web`. Real-time / websocket SDK interfaces are not exposed.

## Skills

```bash
npx skills add kvoon9/skills-weila-work-cli
```

## Install

Install globally from npm:

```bash
npm -g install weila-work-cli
```

Or run once with `npx`:

```bash
npx weila-work-cli --help
```

Verify the installation:

```bash
weila-work-cli --version
weila-work-cli --help
```

## Global options

Every command accepts these global options:

```bash
weila-work-cli <command> [options]
  --profile <name>   Config profile (default: default)
  --base-url <url>   API base URL (default: https://voiswork.cn/v2)
  --app-id <id>      App ID
  --app-key <key>    App Key
  --json             Output raw JSON (default)
  --debug            Print debug information
```

Profile config and tokens are persisted under `~/.config/weila-work-cli/profiles/<profile>/`.

## Commands

Run `weila-work-cli --help` or `weila-work-cli <command> --help` for the full command list.

<!-- cli-help-start -->

```bash
$ weila-work-cli --help
weila-work-cli/0.0.2

Usage:
  $ weila-work-cli <command> [options]

Commands:
  auth:login                     Login with account and password
  auth:whoami                    Get current user info
  org:get                        Get current organization
  org:vip                        Get current organization VIP info
  org:create                     Create an organization
  org:change                     Update organization name/avatar
  address:dept-list              List managed departments
  address:dept-all               List all departments (flat)
  address:dept-tree              List all departments for tree widgets
  address:member-list            Paginated member list across organization
  address:dept-member-list       Paginated members of a department
  address:dept-members           Get all members of a department
  address:member                 Get a single member
  address:member-create          Create a new organization member
  address:member-change          Update an existing member
  address:member-state           Enable or disable a member account
  address:member-delete          Delete a member
  address:dept-members-add       Add existing members to a department
  address:dept-create            Create a department
  address:dept-change            Rename a department
  address:dept-delete            Delete a department
  address:device-add             Add a device member
  address:member-reset-password  Reset a member password
  group:list                     List groups you manage
  group:get                      Get a group by ID
  group:members                  List all members of a group
  group:member-list              Paginated group member list
  group:create                   Create a group
  group:change                   Update a group
  group:delete                   Delete a group
  group:members-add              Add members to a group
  group:member-delete            Remove a member from a group

For more info, run any command with the `--help` flag:
  $ weila-work-cli auth:login --help
  $ weila-work-cli auth:whoami --help
  $ weila-work-cli org:get --help
  $ weila-work-cli org:vip --help
  $ weila-work-cli org:create --help
  $ weila-work-cli org:change --help
  $ weila-work-cli address:dept-list --help
  $ weila-work-cli address:dept-all --help
  $ weila-work-cli address:dept-tree --help
  $ weila-work-cli address:member-list --help
  $ weila-work-cli address:dept-member-list --help
  $ weila-work-cli address:dept-members --help
  $ weila-work-cli address:member --help
  $ weila-work-cli address:member-create --help
  $ weila-work-cli address:member-change --help
  $ weila-work-cli address:member-state --help
  $ weila-work-cli address:member-delete --help
  $ weila-work-cli address:dept-members-add --help
  $ weila-work-cli address:dept-create --help
  $ weila-work-cli address:dept-change --help
  $ weila-work-cli address:dept-delete --help
  $ weila-work-cli address:device-add --help
  $ weila-work-cli address:member-reset-password --help
  $ weila-work-cli group:list --help
  $ weila-work-cli group:get --help
  $ weila-work-cli group:members --help
  $ weila-work-cli group:member-list --help
  $ weila-work-cli group:create --help
  $ weila-work-cli group:change --help
  $ weila-work-cli group:delete --help
  $ weila-work-cli group:members-add --help
  $ weila-work-cli group:member-delete --help

Options:
  -h, --help        Display this message
  -v, --version     Display version number
  --profile <name>  Config profile (default: default)
  --base-url <url>  API base URL
  --app-id <id>     App ID
  --app-key <key>   App Key
  --json            Output raw JSON (default) (default: true)
  --debug           Print debug information
```

<!-- cli-help-end -->

## Examples

### Auth

Login with password (password is MD5-hashed automatically):

```bash
weila-work-cli auth:login --account 70009790 --password 123456
```

Show current user:

```bash
weila-work-cli auth:whoami
```

### Org

Get current organization:

```bash
weila-work-cli org:get
```

Get VIP info:

```bash
weila-work-cli org:vip
```

Create or update an organization:

```bash
weila-work-cli org:create --name "My Org"
weila-work-cli org:change --name "New Name"
```

### Address book

List departments:

```bash
weila-work-cli address:dept-list
weila-work-cli address:dept-tree
```

List members:

```bash
weila-work-cli address:member-list --key "Alice"
weila-work-cli address:dept-member-list --dept-id 5
```

Create, update, or delete a member:

```bash
weila-work-cli address:member-create --name "Alice" --password 123456 --dept-id 5
weila-work-cli address:member-change --user-id 123 --name "Alice Smith"
weila-work-cli address:member-state --user-id 123 --state 0
weila-work-cli address:member-delete --user-id 123
```

Manage departments:

```bash
weila-work-cli address:dept-create --name "Sales"
weila-work-cli address:dept-change --dept-id 5 --name "Marketing"
weila-work-cli address:dept-delete --dept-id 5
weila-work-cli address:dept-members-add --dept-id 5 --user-ids 1,2,3
```

Reset a password:

```bash
weila-work-cli address:member-reset-password --user-id 123 --password 654321
```

### Groups

List groups:

```bash
weila-work-cli group:list
```

Get group members:

```bash
weila-work-cli group:members --id 80001359
```

Create and manage a group:

```bash
weila-work-cli group:create --name "Ops" --burst-mode 1
weila-work-cli group:change --id 123 --name "New Name"
weila-work-cli group:delete --id 123
weila-work-cli group:members-add --id 123 --user-ids 1,2,3
weila-work-cli group:member-delete --id 123 --user-id 456
```

## Development

```bash
# Install dependencies
pnpm install

# Build for production
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Bump version and tag
pnpm bump

# Publish (requires npm OTP)
npm publish
```

## License

[MIT](../../LICENSE) © kvoon
