---
title: 本地开发环境
---

# 本地开发环境

需要 Node >= 22.18 与 pnpm 12；`mise.toml` 已固定 Node 24.22.3、pnpm 12.23.0。

```bash
curl https://mise.run | sh        # 或 brew install mise
git clone https://github.com/voischat/work.git && cd work
mise trust && mise install
pnpm install
```

## 环境变量

密钥存放在 1Password（vault `Personal`，条目 `Weila Work env`），`env/*.env.template` 只含 `op://` 引用，可安全提交。

首次使用：安装 1Password 桌面版与 CLI（`brew install --cask 1password 1password-cli`），登录后在 Settings → Developer 勾选 **Integrate with 1Password CLI**；新机器执行 `op account add --address my.1password.com --email <你的邮箱>`（需 Emergency Kit 的 Secret Key），之后只需 `op signin`（桌面版已解锁时自动通过）。

```bash
pnpm env:setup    # 渲染下列文件，权限 0600
```

| 文件                                               | 变量                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/website/.env`                                | `VITE_WEB_SOCK`                                                              |
| `apps/playground-vue3/.env`                        | `VITE_WEILA_WSS`、`VITE_WEILA_APP_ID`、`VITE_WEILA_APP_KEY`                  |
| `packages/core/tests/integration/.env.integration` | 10 个 `WEILA_TEST_*`                                                         |
| `~/.voischat/env.sh`                               | `WEILA_QA_ACCOUNT`、`WEILA_QA_PASSWORD`（供 `.claude/skills/verify-*` 使用） |

在 `~/.zshrc` 加载 QA 账号：

```bash
echo '[ -f ~/.voischat/env.sh ] && source ~/.voischat/env.sh' >> ~/.zshrc
```

`packages/core/.env` 故意不存在：SDK 发布时不嵌入 APPID/APPKEY，由接入方初始化时传入。

## 常用命令

```bash
pnpm dev            # 企业管理台
pnpm build          # 全量构建（先 SDK，再各应用）
pnpm typecheck
pnpm lint
pnpm test
```

完整命令、门禁与部署见仓库根的 [AGENTS.md](https://github.com/voischat/work/blob/main/AGENTS.md)。

## 补充

- **浏览器测试**：跑 dist 冒烟测试或 `.claude/skills/verify-*` 前执行 `pnpm -C packages/core exec playwright install chromium`；单元测试不需要。
- **本地部署**：`pnpm exec wrangler login` 并用公司 Cloudflare 账号授权；CI 使用仓库 secret，日常开发不用配置。
- **worktree**：每个新 worktree 执行一次 `pnpm env:setup`；Claude Code 的 worktree 由 `.worktreeinclude` 自动带上仓库内三个文件。
- **1Password 会话**：桌面版自动更新会重启并丢会话，重新 `op signin`；脚本里把 signin 与命令串在同一次执行最稳妥。
