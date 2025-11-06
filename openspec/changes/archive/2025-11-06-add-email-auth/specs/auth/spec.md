## ADDED Requirements
### Requirement: Email Verification
The system SHALL allow users to receive email verification codes for authentication purposes.

#### Scenario: 发送邮箱验证码
- **WHEN** 用户请求邮箱验证码
- **THEN** 系统通过 `/common/send-email-verifycode` 发送验证码到用户邮箱
- **AND** 验证码10分钟后过期

#### Scenario: 验证邮箱验证码
- **WHEN** 用户提供有效的邮箱验证码
- **THEN** 系统验证验证码
- **AND** 标记邮箱为已验证

### Requirement: Email-based Authentication
The system SHALL allow users to authenticate using email and verification codes.

#### Scenario: 邮箱验证码登录
- **WHEN** 用户提供有效的邮箱和验证码
- **THEN** 系统通过 `/corp/auth/login-by-email` 认证用户
- **AND** 返回认证令牌

#### Scenario: 邮箱注册
- **WHEN** 用户使用邮箱、密码和验证码注册
- **THEN** 系统通过 `/corp/auth/regist-by-email` 创建新用户账户

### Requirement: Email Password Reset
The system SHALL allow users to reset their password using email verification.

#### Scenario: 请求密码重置
- **WHEN** 用户使用邮箱请求密码重置
- **THEN** 系统发送密码重置验证码

#### Scenario: 完成密码重置
- **WHEN** 用户提供有效的重置验证码和新密码
- **THEN** 系统通过 `/corp/auth/reset-password-by-email` 更新用户密码
- **AND** 使现有会话失效

## MODIFIED Requirements
### Requirement: User Authentication
The system SHALL provide multiple authentication methods including SMS and email verification.

#### Scenario: 短信登录
- **WHEN** 用户提供有效的手机号和短信验证码
- **THEN** 系统通过 `/corp/auth/login-by-sms` 认证用户
- **AND** 返回认证令牌

#### Scenario: 邮箱登录
- **WHEN** 用户提供有效的邮箱和邮箱验证码
- **THEN** 系统通过 `/corp/auth/login-by-email` 认证用户
- **AND** 返回认证令牌

#### Scenario: 密码登录
- **WHEN** 用户提供有效的凭据（手机号/邮箱和密码）
- **THEN** 系统通过 `/corp/auth/login` 认证用户
- **AND** 返回认证令牌
