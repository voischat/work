# Weila Enterprise Management System

Vue 3 + TS monorepo (pnpm workspaces). Enterprise comms: contacts, messaging, devices, org structure.

## Tech

- **UI**: Arco Design Vue 2.57, UnoCSS 66.1, Less, Iconify (Carbon/Ph)
- **HTTP**: Axios + ofetch
- **Router**: Vue Router + auto-routing (unplugin-vue-router)
- **State**: Pinia
- **Forms**: Valibot + Zod
- **Maps**: Vue AMap (Gaode)
- **Charts**: Vue ECharts
- **Query**: TanStack Vue Query
- **i18n**: Vue i18n

## Commands

| Command | What |
|---------|------|
| `pnpm dev:prod` | Start dev server (production profile) |
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm build:staging` | Staging build |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint + fix |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Vitest |
| `pnpm release` | Bump version + release |

## Electron Packaging

Desktop build (embeds the eve agent). Full guide + troubleshooting: `packages/web/BUILD.md`.

```bash
# Unpacked dir build, fastest for local verification (win=x64 / mac=arm64 per electron-builder.yml)
pnpm --filter weila-work-web run electron:build:dir
# Full build
pnpm --filter weila-work-web run electron:build
```

Pipeline: `scripts/prepare-agent.cjs` (eve build → build weila-work-cli → clean pnpm-deploy leftovers → deploy → prune native) → `vite build` → `scripts/fix-electron-build.cjs` → `electron-builder`. Output in `packages/web/release/<version>/`.

## CLI Release Flow

`packages/cli` publishes `weila-work-cli` to npm and keeps the agent skill in sync.

1. **Bump and publish the CLI**
   ```bash
   cd packages/cli
   pnpm bump        # bumps version and creates a git tag
   npm publish      # requires npm OTP
   ```

2. **Sync the agent skill**
   Skill source lives in `packages/cli/skills/weila-work-cli/`. The sync script reads the CLI version from `packages/cli/package.json`, updates `SKILL.md` metadata, mirrors the skill to the workspace agent directory (`../.agents/skills/weila-work-cli/`), and pushes to the public skill repo.
   ```bash
   # Sync to local agent only
   pnpm --filter weila-work-cli sync:skills

   # Sync and push to GitHub
   pnpm --filter weila-work-cli publish:skills
   ```

   Public skill repo: `https://github.com/kvoon9/skills-weila-work-cli`  
   Install by users: `npx skills add kvoon9/skills-weila-work-cli`

3. **Verify**
   - Check npm version at `https://www.npmjs.com/package/weila-work-cli`
   - Check the skill repo has the latest `skills/weila-work-cli/SKILL.md`

## Code Style

- ESLint: `@antfu/eslint-config` with Vue i18n plugin + TanStack Query rules
- **No `ref()`** — use `shallowRef()` or `deepRef()` instead
- Auto-imports: Vue 3 APIs, VueUse, Pinia stores, Vue Router, `src/composables/`
- Components auto-imported from `src/components/`, Arco/Radix/AMap resolved automatically
- Naming: components PascalCase, composables `use*` camelCase, utils camelCase

## Testing

start dev server via `nr dev:prod`:

login account by using `agent-browser`:

- **Account**: `70009790`
- **Password**: `123456`

## 更新用户手册流程

`weila-work/docs` 是 VitePress 用户手册。当功能变更需要同步文档或截图时，按以下流程执行：

1. **启动本地服务**
   ```bash
   pnpm dev:prod
   ```
   默认监听 `https://localhost:5173`

2. **登录并截图**
   使用 `agent-browser` 登录测试账号，按实际交互操作后截图：
   - 账号：`70009790`
   - 密码：`123456`
   - 示例命令：
     ```bash
     agent-browser open https://localhost:5173 --ignore-https-errors --session-name weila-work-docs
     agent-browser snapshot -i
     agent-browser screenshot docs/assets/xxx.png
     ```
   - 新截图统一保存到 `docs/assets/`，使用 kebab-case 描述性文件名。
   - 更新现有截图时尽量保持同名，避免修改 markdown 引用。

3. **更新文档内容**
   - Markdown 源文件位于 `docs/` 及其子目录。
   - 子目录中的 markdown 引用图片时使用 `../assets/<filename>.png`。
   - 新增/拆分类别时同步更新 `docs/.vitepress/config.mts` 的 `sidebar`。
   - 删除或迁移旧页面后，检查首页 `docs/index.md` 的链接是否失效。

4. **构建验证**
   ```bash
   pnpm docs:build
   ```
   确保无构建错误，且 `docs/.vitepress/dist/` 中生成了新增/修改的页面和图片。

5. **清理环境**
   - 关闭 `agent-browser` 会话。
   - 停止 `pnpm dev:prod` 后台进程。
   - 检查 `git status`，撤销无关文件变更（如 `packages/web/src/components.d.ts` 等自动生成的文件）。

