# weila-work-cli

CLI for Weila Work management APIs (auth + org/address/group management).

> Scope: wraps the HTTP endpoints used by `weila-work/packages/web`. Real-time / websocket SDK interfaces are not exposed.

## Install

```bash
pnpm install
```

The CLI binary is registered as `weila-work-cli`.

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

## Auth

Login with password (password is MD5-hashed automatically):

```bash
weila-work-cli auth:login --account 70009790 --password 123456
```

Show current user:

```bash
weila-work-cli auth:whoami
```

## Org

Get current organization:

```bash
weila-work-cli org:get
```

Get VIP info:

```bash
weila-work-cli org:vip
```

## Address book

List departments:

```bash
weila-work-cli address:dept-list
```

List members:

```bash
weila-work-cli address:member-list --key "Alice"
```

Create a member:

```bash
weila-work-cli address:member-create --name "Alice" --password 123456 --dept-id 5
```

## Groups

List groups:

```bash
weila-work-cli group:list
```

Get group members:

```bash
weila-work-cli group:members --id 80001359
```

Run `weila-work-cli --help` or `weila-work-cli <command> --help` for the full command list.
