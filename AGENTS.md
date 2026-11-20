# Weila Enterprise Management System

Vue 3 + TS monorepo (pnpm workspaces). Enterprise comms: contacts, messaging, devices, org structure.

## Tech

- **UI**: Arco Design Vue 2.57, UnoCSS 66.1, Less, Iconify (Carbon/Ph)
- **HTTP**: Axios + ofetch
- **Router**: Vue Router + auto-routing (unplugin-vue-router)
- **State**: Pinia
- **Forms**: Valibot
- **Maps**: Vue AMap (Gaode)
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
| `pnpm knip` | Unused files, exports, dependencies (must report zero findings) |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Vitest |
| `pnpm release` | Bump version + release |

## Code Style

- ESLint: `@antfu/eslint-config` with Vue i18n plugin + TanStack Query rules
- **No `ref()`** — use `shallowRef()` or `deepRef()` instead
- Auto-imports: Vue 3 APIs, VueUse, Pinia stores, Vue Router, `src/composables/`
- Components auto-imported from `src/components/`, Arco/Radix/AMap resolved automatically
- Naming: components PascalCase, composables `use*` camelCase, utils camelCase

## Testing

start dev server via `nr dev:prod`:

login account by using `ego-browser` (ego lite). The shared helpers in `.claude/skills/lib/ego-driver.mjs` cover login, CDP network capture, and route mocking; the drive recipes live in `.claude/skills/verify-weila-work-web/SKILL.md`.

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
   使用 `ego-browser` 登录测试账号，按实际交互操作后截图：
   - 账号：`70009790`
   - 密码：`123456`
   - 示例脚本（通过 `ego-browser nodejs` 运行）：
     ```js
     const driver = await import('<仓库绝对路径>/.claude/skills/lib/ego-driver.mjs')
     const task = await taskSpace('weila docs screenshots')
     const page = task.page('p1')
     await driver.ensureLogin(page, 'https://localhost:5173', '70009790', '123456')
     console.log(await page.snapshot())
     await page.screenshot({ path: '<仓库绝对路径>/docs/assets/xxx.png' }) // 必须绝对路径
     await task.finish({ keep: [] })
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
   - 用 `task.finish({ keep: [] })` 结束 `ego-browser` TaskSpace。
   - 停止 `pnpm dev:prod` 后台进程。
   - 检查 `git status`，撤销无关文件变更（如 `packages/web/src/components.d.ts` 等自动生成的文件）。
