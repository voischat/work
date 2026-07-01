---
description: 当用户需要查询或管理微喇企业管理台（Weila Work）的企业信息、部门、成员或群组等数据时使用，说明可用命令和参数。
---

# Weila Work CLI 完整命令参考

本 skill 说明 `weila_cli` tool 支持的所有命令。调用格式：`weila_cli({command, args})`，其中 `args` 是 `["--key", "value", ...]` 格式的数组。

## 认证

agent 运行在已登录的微喇 Work app 内，access token 由用户当前登录会话自动注入，tool 调用无需任何额外登录。

- **不要**提示用户执行 `weila-work-cli auth:login`，也不要索取账号、密码或手动 token。
- 若工具因缺少 token 而失败，提示用户确认已在微喇 Work app 内登录后重试。

## Org 命令

| 命令 | 用途 | 参数 |
|------|------|------|
| `org:get` | 获取企业基本信息（名称、成员数、部门数等） | 无 |
| `org:vip` | 获取企业 VIP 信息（等级、到期时间、功能限额） | 无 |
| `org:change` | 修改企业名称/头像 | `--name <名称>` `--avatar <URL>` |

## Address 命令

### 部门

| 命令 | 用途 | 参数 |
|------|------|------|
| `address:dept-tree` | 获取企业所有部门（树形结构，含 ID/名称/成员数） | 无 |
| `address:dept-list` | 获取所管理的部门列表 | `--dept-id <id>`（可选） |
| `address:dept-all` | 获取所有部门（扁平列表） | 无 |
| `address:dept-create` | 创建部门 | `--name <名称>` |
| `address:dept-change` | 重命名部门 | `--dept-id <id>` `--name <新名称>` |
| `address:dept-delete` | 删除部门 | `--dept-id <id>` |
| `address:dept-members-add` | 添加已有成员到部门 | `--dept-id <id>` `--user-ids <ID1,ID2,...>` |

### 成员

| 命令 | 用途 | 参数 |
|------|------|------|
| `address:member-list` | 分页搜索成员（跨部门） | `--key <关键词>` `--dept-ids <ID1,ID2>` `--member-types <类型>` `--page <页码>` `--size <每页数>` |
| `address:dept-member-list` | 分页查询部门成员 | `--dept-id <id>` `--key <关键词>` `--page <页码>` `--size <每页数>` |
| `address:dept-members` | 获取部门全部成员 | `--dept-id <id>` |
| `address:member` | 获取单个成员详情 | `--id <成员ID>` |
| `address:member-create` | 创建新成员 | `--name <姓名>` `--password <密码>` `--dept-id <部门ID>` `--phone <手机号>` `--job-num <工号>` `--sex <0女/1男>` `--is-dept-admin <true/false>` `--loc-share <true/false>` `--track <true/false>` `--avatar <URL>` |
| `address:member-change` | 修改成员信息 | `--user-id <id>` `--name <姓名>` `--phone <手机号>` `--job-num <工号>` `--dept-id <部门ID>` `--sex <0/1>` `--is-dept-admin <true/false>` `--loc-share <true/false>` `--track <true/false>` |
| `address:member-state` | 启用/禁用成员账号 | `--user-id <id>` `--state <0禁用/1启用>` |
| `address:member-delete` | 删除成员 | `--user-id <id>` |
| `address:member-reset-password` | 重置成员密码 | `--user-id <id>` `--password <新密码>` |
| `address:device-add` | 添加设备成员 | `--name <设备名>` `--verifycode <验证码>` `--dept-id <部门ID>` `--job-num <工号>` |

## Group 命令

| 命令 | 用途 | 参数 |
|------|------|------|
| `group:list` | 分页获取管理的群组列表 | `--page <页码>` `--size <每页数>` |
| `group:get` | 获取单个群组详情 | `--id <群组ID>` |
| `group:members` | 获取群组全部成员 | `--id <群组ID>` |
| `group:member-list` | 分页查询群组成员 | `--id <群组ID>` `--page <页码>` `--size <每页数>` |
| `group:create` | 创建群组 | `--name <名称>` `--burst-mode <0/1>` `--avatar <URL>` |
| `group:change` | 修改群组 | `--id <群组ID>` `--name <名称>` `--burst-mode <0/1>` `--avatar <URL>` |
| `group:delete` | 删除群组 | `--id <群组ID>` |
| `group:members-add` | 添加成员到群组 | `--id <群组ID>` `--user-ids <ID1,ID2,...>` |
| `group:member-delete` | 从群组移除成员 | `--id <群组ID>` `--user-id <成员ID>` |

## 命令示例

```
# 企业信息
weila_cli({command: "org:get"})
weila_cli({command: "org:vip"})

# 部门
weila_cli({command: "address:dept-tree"})
weila_cli({command: "address:dept-create", args: ["--name", "技术部"]})

# 成员
weila_cli({command: "address:member-list", args: ["--key", "张三", "--page", "1", "--size", "20"]})
weila_cli({command: "address:member", args: ["--id", "123"]})
weila_cli({command: "address:member-create", args: ["--name", "李四", "--password", "123456", "--dept-id", "5"]})
weila_cli({command: "address:member-state", args: ["--user-id", "123", "--state", "0"]})

# 群组
weila_cli({command: "group:list", args: ["--page", "1", "--size", "20"]})
weila_cli({command: "group:get", args: ["--id", "456"]})
weila_cli({command: "group:create", args: ["--name", "运维群"]})
```

## 注意

- `--page` 默认 1，`--size` 默认 20。
- `--dept-ids` 和 `--user-ids` 用逗号分隔多个 ID。
- `--sex` 接受 0（女）或 1（男）。
- `--is-dept-admin`、`--loc-share`、`--track`、`--burst-mode` 接受 `true`/`false`/`0`/`1`。
- 密码类参数（`--password`）会自动 MD5 哈希后传输，不需要手动哈希。
- 只读和写操作都经过同一 tool 执行，根据命令不同自动判定。
