---
description: 当用户需要查询微喇企业管理台（Weila Work）的企业信息、部门、成员或群组等真实数据时使用，说明可调用的只读 tools。
---

# Weila Work CLI 能力说明

本 skill 说明 agent 可以如何通过 `weila-work-cli` 查询微喇企业管理台数据。

## 已暴露的 tools

| Tool | 用途 |
|------|------|
| `weila_org_get` | 获取当前企业信息 |
| `weila_dept_tree` | 获取企业部门列表 |
| `weila_member_list` | 搜索/分页查询成员 |
| `weila_group_list` | 查询管理的群组列表 |

## 认证

agent 运行在已登录的微喇 Work app 内，access token 由用户当前登录会话自动注入（请求头 `x-weila-token` → 透传为 CLI 的 `--token`），tool 调用无需任何额外登录。

- **不要**提示用户执行 `weila-work-cli auth:login`，也不要索取账号、密码或手动 token。
- 若工具因缺少 token 而失败，按 `weila_work_app` skill 的指引处理（提示用户确认已登录 app），而非回退账号密码登录。

## 注意

- 目前只提供只读查询能力，不执行创建、修改、删除操作。
- 返回的数据结构来自微喇管理 API，字段命名保持原样（如 `user_id`、`dept_id`）。
