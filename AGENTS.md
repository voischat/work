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

