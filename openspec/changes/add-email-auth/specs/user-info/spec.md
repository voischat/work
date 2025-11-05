## ADDED Requirements
### Requirement: Email Management
The system SHALL allow users to manage their email address in their profile.

#### Scenario: 绑定邮箱到账户
- **WHEN** 用户添加邮箱地址到个人资料
- **THEN** 系统发送验证码到该邮箱
- **AND** 验证后，邮箱通过 `/corp/user/bind-email` 绑定到用户账户

#### Scenario: 更改绑定邮箱
- **WHEN** 用户更改其绑定邮箱
- **THEN** 系统发送验证码到新邮箱
- **AND** 验证后，邮箱被更新
- **AND** 旧邮箱被解绑

#### Scenario: 解绑邮箱
- **WHEN** 用户从个人资料中移除邮箱
- **THEN** 系统通过 `/corp/user/unregist-by-email` 移除邮箱绑定
- **AND** 基于邮箱的认证被禁用

### Requirement: Email Verification Status
The system SHALL allow users to see the verification status of their email address.

#### Scenario: 查看邮箱验证状态
- **WHEN** 用户查看其个人资料
- **THEN** 系统显示邮箱验证状态
- **AND** 为已验证邮箱显示验证徽章

#### Scenario: 重新发送邮箱验证
- **WHEN** 用户请求重新发送邮箱验证
- **THEN** 系统发送新的验证码

## MODIFIED Requirements
### Requirement: User Profile Information
The system SHALL store and display comprehensive user profile information including contact methods.

#### Scenario: 查看用户资料
- **WHEN** 用户查看其个人资料
- **THEN** 系统显示手机号和邮箱地址
- **AND** 显示两种联系方式的验证状态

#### Scenario: 更新用户资料
- **WHEN** 用户更新其个人资料信息
- **THEN** 系统验证邮箱格式（如果提供）
- **AND** 邮箱更改需要验证
