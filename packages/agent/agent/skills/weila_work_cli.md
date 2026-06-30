# Weila Work CLI 能力说明

本 skill 说明 agent 可以如何通过 `weila-work-cli` 查询微喇企业管理台数据。

## 已暴露的 tools

| Tool | 用途 |
|------|------|
| `weila_org_get` | 获取当前企业信息 |
| `weila_dept_tree` | 获取企业部门列表 |
| `weila_member_list` | 搜索/分页查询成员 |
| `weila_group_list` | 查询管理的群组列表 |

## 前置条件

用户需要先通过 `weila-work-cli auth:login --account <账号> --password <密码>` 登录一次，tool 会复用 CLI 的 profile/token。

## 注意

- 目前只提供只读查询能力，不执行创建、修改、删除操作。
- 返回的数据结构来自微喇管理 API，字段命名保持原样（如 `user_id`、`dept_id`）。
