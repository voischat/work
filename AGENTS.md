# Weila Monorepo Agent Guide

This repository merged `weila-js-sdk` and `weila-work` into one pnpm workspace. The SDK packages keep their history and layout, the enterprise console moved to `apps/website`, and the SDK playground moved to `apps/playground-vue3`.

## Layout

```
.
├── packages/
│   ├── core/            # @vois/weila-sdk-core, TypeScript SDK (Rspack 2 + SWC)
│   └── ui/              # @vois/weila-sdk-ui, Vue 3 components (tsdown)
├── apps/
│   ├── website/         # Enterprise console, Vue 3 + Arco (was packages/web)
│   └── playground-vue3/ # SDK playground, Vue 3 + Vite
├── docs/                # VitePress user manual (and the audio flow docs)
├── scripts/             # repo scripts, including the commit-hook spec
└── .claude/skills/      # agent skills (SDK integration, verifications)
```

Repository-specific rules:

- `packages/core/AGENTS.md` covers the SDK internals, aliases and build steps.
- `apps/website/AGENTS.md` covers the console's stack, commands, testing account and the user-manual screenshot flow.

## Toolchain

- Node >= 22.18 (the Oxlint and Oxfmt configs use Node's type stripping), pnpm 11.28.13.
- One lockfile, one catalog in `pnpm-workspace.yaml`. Dependencies use `catalog:` everywhere. Software Composition Analysis: dependency advisories surface through Dependabot alerts, but Dependabot's update and security-PR jobs are disabled because it cannot edit pnpm catalog entries. Bump versions with `pnpm up` or a catalog edit, and pin transitive security floors in the `overrides` block; `pnpm audit` must stay clean. The named `web` catalog pins the website's `vue`/`vue-tsc` pair, because neither vue-tsc 3.1.1 nor 3.3.x satisfies both the UI d.ts build and the website template typings.
- Lint and format run as two tracks:
  - `packages/*` and `apps/playground-vue3` use Oxlint and Oxfmt (`oxlint.config.ts`, `oxfmt.config.ts`). The lint-budget gate lives at `packages/core/scripts/lint-budget.mjs`.
  - `apps/website` uses ESLint (`eslint.config.mjs`).
  - The pre-commit hook (`nano-staged`) routes staged files to the matching track.
- Turborepo drives every workspace task. The `:sdk` aliases filter to `./packages/*`, `build:web` filters to the website, and the unfiltered commands cover all four projects, so a website build pulls its SDK dependencies first through `dependsOn: ["^build"]`.

## Commands

Run from the repo root.

| Command                        | What                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| `pnpm dev`                     | website dev server                                              |
| `pnpm dev:prod`                | website dev server, production profile                          |
| `pnpm dev:sdk`                 | SDK packages and playground in dev/watch mode                   |
| `pnpm build`                   | turbo build for every workspace project                         |
| `pnpm build:sdk`               | turbo build limited to `packages/*`                             |
| `pnpm build:web`               | turbo build for the website and its workspace dependencies      |
| `pnpm typecheck`               | turbo typecheck for every workspace project                     |
| `pnpm typecheck:sdk`           | turbo typecheck limited to `packages/*`                         |
| `pnpm lint`                    | `lint:web` and `lint:sdk`                                       |
| `pnpm test`                    | turbo test for every workspace project (website runs non-watch) |
| `pnpm test:run`                | turbo test:run for `packages/*`                                 |
| `pnpm knip`                    | unused files, exports, dependencies (must report zero findings) |
| `pnpm fmt` / `pnpm fmt:check`  | Oxfmt over everything except `apps/website`                     |
| `pnpm docs:dev` / `docs:build` | VitePress user manual                                           |

## Gates

`.github/workflows/gates.yml` runs, for the SDK track: `fmt:check`, `build:sdk`, `api:snapshot`, `typecheck:sdk`, `typecheck:tsc:sdk`, `typecheck:parity`, `typecheck:strict-budget`, `knip`, `lint:sdk`, `test:scripts`, `test:sdk`, the Playwright dist smoke test, and `build:story`. The `web` job runs `lint:web` and then the website's turbo `typecheck`, `test` and `build`, which pull the SDK builds through the task graph.

`scripts/commit-hooks.spec.mjs` asserts the hook wiring, so changing `nano-staged` globs or the hook runner means updating that spec.

## Deployments

`.github/workflows/deploy.yml` builds and deploys all four sites on every push to `main`, using the `CLOUDFLARE_API_TOKEN` repo secret. `apps/website` and `apps/playground-vue3` deploy with `wrangler deploy`; their `wrangler.jsonc` pins the Worker name, account and assets directory, and `infra/cloudflare/proxy-worker.ts` serves the SPA while proxying `/v1/*` and `/v2/*` to `https://api.voischat.cn` so the same-origin API paths work in production. `packages/ui` (Storybook) and `docs` (VitePress) deploy with `void deploy --platform cloudflare --dir ... --skip-build`, naming their Worker in `void.config.ts`. Production only, no per-PR previews. Worker names are `work-web`, `work-playground`, `work-ui` and `work-docs` under the account's workers.dev subdomain.

## Skills

Agent skills live in `.claude/skills/`. The verification skills drive the real console through ego-browser; start `pnpm dev:prod` and read the `Local:` URL from its log instead of assuming a port. They read the QA account from `WEILA_QA_ACCOUNT` and `WEILA_QA_PASSWORD` in the environment (see `.env.example`); real credentials are never committed.
