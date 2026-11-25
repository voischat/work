# Weila

微喇 Web SDK 与企业管理系统，同一个 pnpm workspace。

| 目录                   | 内容                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| `packages/core`        | `@vois/weila-sdk-core`，TypeScript SDK（WebSocket、音频、protobuf、IndexedDB） |
| `packages/ui`          | `@vois/weila-sdk-ui`，Vue 3 组件库                                             |
| `apps/website`         | 企业管理台（Vue 3 + Arco + UnoCSS）                                            |
| `apps/playground-vue3` | SDK 联调 playground                                                            |
| `docs`                 | VitePress 用户手册                                                             |

## 在线地址

每次 push 到 `main`，`.github/workflows/deploy.yml` 会构建并部署全部四个站点到 Cloudflare Workers：

| 站点                            | 地址                                         |
| ------------------------------- | -------------------------------------------- |
| 企业管理台（`apps/website`）    | https://work-web.voischat.workers.dev        |
| SDK Playground                  | https://work-playground.voischat.workers.dev |
| 组件 Storybook（`packages/ui`） | https://work-ui.voischat.workers.dev         |
| 用户手册（`docs`，VitePress）   | https://work-docs.voischat.workers.dev       |

企业管理台通过同源代理访问后端：`/v1/*` 与 `/v2/*` 由 Worker 转发到 `https://api.voischat.cn`。

## 开始

```bash
pnpm install
pnpm dev              # 企业管理台，https://localhost:5173
pnpm build            # 先构建 SDK，再构建企业管理台
pnpm typecheck        # SDK 与企业管理台类型检查
pnpm lint             # 两条 lint 线：apps/website 用 ESLint，其余用 Oxlint
```

完整命令与工具链说明见 [AGENTS.md](./AGENTS.md)；新机器搭建、1Password 环境变量渲染见[本地开发环境](./docs/development.md)。企业管理台详见 `apps/website/AGENTS.md`，SDK 内部结构见 `packages/core/AGENTS.md`。

## License

专有软件，保留所有权利。公开仅供查看与评估，不授予使用、修改或分发许可。详见 [LICENSE](./LICENSE)。

## 关于本仓库

这是微喇企业内部仓库的公开视图，公开历史从首个公开提交开始，内部开发历史不在此仓库中。
