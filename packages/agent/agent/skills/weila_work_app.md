---
description: 当 agent 运行在微喇企业管理台（Weila Work）的桌面 app / Electron 环境内时使用，说明该环境下的认证方式、token 来源与缺失处理。
---

# 微喇 Work App 运行环境

本 skill 描述 agent 嵌入在微喇企业管理台（Weila Work）桌面 app（Electron）内运行时的环境约定，重点是认证与 token。

## 运行环境

- agent 作为本地服务被 Electron app 拉起，前端聊天面板嵌在 app 的 web 界面里。
- 用户已经在 app 内用 web 界面登录，因此**当前会话天然带有 access token**。

## 认证与 token 来源

- token 来自用户当前登录的 web 会话，由前端以请求头 `x-weila-token` 发送，会话层写入 `session.auth.current.attributes.token`，最终透传给 `weila-work-cli --token`。
- 这是 app 环境下**唯一**的认证方式：
  - **不需要**、也**不应该**让用户提供账号、密码或手动 token。
  - **不要**提示运行 `weila-work-cli auth:login` 或 `auth:set-token`。
  - **不要**回退到 CLI 本地 profile 登录态。

## token 缺失时的处理

如果工具调用因缺少有效 token 而失败（例如会话未携带 token 或已过期）：

- 提示用户「请确认已在微喇 Work app 内登录后重试」。
- 不要尝试用账号密码登录，也不要索取 token。

## 能力边界

- 当前为只读 MVP：仅支持企业信息、部门、成员、群组的查询（见 `weila_work_cli` skill 的 tools）。
- 不执行任何创建、修改、删除等副作用操作。
