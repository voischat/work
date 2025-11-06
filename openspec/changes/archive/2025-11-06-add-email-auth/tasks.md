## 1. API客户端集成
- [ ] 1.1 扩展用户数据模型包含邮箱字段 (`bind_email`)
- [ ] 1.2 实现邮箱验证码发送API调用 (`/common/send-email-verifycode`)
- [ ] 1.3 实现邮箱注册API调用 (`/corp/auth/regist-by-email`)
- [ ] 1.4 实现邮箱登录API调用 (`/corp/auth/login-by-email`)
- [ ] 1.5 实现邮箱密码重置API调用 (`/corp/auth/reset-password-by-email`)
- [ ] 1.6 实现邮箱绑定API调用 (`/corp/user/bind-email`)
- [ ] 1.7 实现邮箱解绑API调用 (`/corp/user/unregist-by-email`)

## 2. 前端认证功能
- [ ] 2.1 扩展认证存储支持邮箱认证 (参考 `packages/web/src/stores/auth.ts`)
- [ ] 2.2 添加邮箱验证码发送功能 (参考现有短信验证码模式)
- [ ] 2.3 更新登录页面添加邮箱登录选项 (参考 `packages/web/src/pages/login/index.vue`)
- [ ] 2.4 更新注册页面添加邮箱注册选项 (参考 `packages/web/src/pages/register/index.vue`)
- [ ] 2.5 更新密码重置页面添加邮箱重置选项

## 3. 用户信息管理
- [ ] 3.1 扩展用户信息存储包含邮箱字段 (参考 `packages/web/src/stores/selfInfo.ts`)
- [ ] 3.2 添加邮箱绑定/解绑用户界面
- [ ] 3.3 更新用户资料显示邮箱信息
- [ ] 3.4 添加邮箱验证状态管理

## 4. 国际化
- [ ] 4.1 添加邮箱相关字符串到i18n文件
- [ ] 4.2 更新邮箱字段的表单验证消息
- [ ] 4.3 添加邮箱特定的错误消息

## 5. 测试和验证
- [ ] 5.1 编写邮箱认证流程的单元测试
- [ ] 5.2 测试邮箱验证码功能
- [ ] 5.3 验证邮箱绑定/解绑工作流
- [ ] 5.4 测试通过邮箱重置密码
- [ ] 5.5 运行完整集成测试
