## Why
目前应用主要支持基于短信的认证和手机号管理。虽然后端API已经提供了邮箱相关接口，但前端尚未实现对应的邮箱功能。添加邮箱功能将为用户提供替代的认证方式，并启用基于邮箱的通知、密码重置和账户恢复选项。

## What Changes
- **ADDED** 邮箱验证码发送和验证功能
- **ADDED** 邮箱注册、登录和密码重置前端界面
- **ADDED** 邮箱绑定和解绑用户界面
- **MODIFIED** 用户数据模型包含邮箱字段
- **MODIFIED** 认证流程支持邮箱和短信并行

## Impact
- Affected specs: `auth`, `user-info`
- Affected code:
  - 认证存储 (`packages/web/src/stores/auth.ts`)
  - 用户信息存储 (`packages/web/src/stores/selfInfo.ts`)
  - 登录/注册页面 (`packages/web/src/pages/login/`, `packages/web/src/pages/register/`)
  - API客户端和端点
  - 用户数据模型和接口
