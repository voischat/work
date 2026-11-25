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
│   ├── playground-vue3/ # SDK playground, Vue 3 + Vite
│   └── mock/            # Void app serving website API fixtures in development
├── docs/                # VitePress user manual (and the audio flow docs)
├── qa/                  # manual QA runs and test cases
├── scripts/             # repo scripts, including the commit-hook spec
└── .claude/skills/      # agent skills (SDK integration, verifications)
```

Repository-specific rules:

- `packages/core/AGENTS.md` covers the SDK internals, aliases and build steps.
- `apps/website/AGENTS.md` covers the console's stack, commands, testing account and the user-manual screenshot flow.

## Toolchain

- Node >= 22.18 (the Oxlint and Oxfmt configs use Node's type stripping), pnpm 11.28.13.
- One lockfile, one catalog in `pnpm-workspace.yaml`. Dependencies use `catalog:` everywhere and `pnpm run manifests` enforces it: a literal range fails the gate, and a package in both `dependencies` and `devDependencies` fails too. Named catalogs cover the deliberate divergences. `native` holds the TypeScript 7 native compiler that `packages/core` builds with, while `vue-tsc` and `tsdown` stay on the 6.x API. `playground` holds the playground's `vue-router` 5 against the console's 4. Software Composition Analysis: dependency advisories surface through Dependabot alerts, but Dependabot's update and security-PR jobs are disabled because it cannot edit pnpm catalog entries. Bump versions with `pnpm up` or a catalog edit, and pin transitive security floors in the `overrides` block; `pnpm audit` must stay clean. The named `web` catalog pins the website's `vue`/`vue-tsc` pair, because neither vue-tsc 3.1.1 nor 3.3.x satisfies both the UI d.ts build and the website template typings.
- A shared `no-comments` rule (`tools/lint/no-comments.mjs`) runs in both lint engines: it allows only tool directives, legal headers, `SAFETY:` rationale and bare links, and it autofixes by deleting the comment. `scripts/no-comments.ts` covers the surfaces neither linter parses (Vue templates and style blocks, plain CSS/Less/HTML) and runs as `lint:comments`.
- Lint and format run as two tracks:
  - `packages/*` and `apps/playground-vue3` use Oxlint and Oxfmt (`oxlint.config.ts`, `oxfmt.config.ts`). The lint-budget gate lives at `packages/core/scripts/lint-budget.mjs`. Type-aware linting runs on `tsrs` (the `native` catalog entry), the same engine as core's `typecheck`. The budget script passes `--report-unused-disable-directives`, so a suppression comment that no longer suppresses anything fails the gate. Oxlint can also emit compiler diagnostics through `--type-check` at no extra cost, but the lint scope covers tests that live outside `tsconfig.json`, so the gate keeps type checking to the `typecheck` scripts.
  - `apps/website` uses ESLint (`eslint.config.mjs`).
  - The pre-commit hook (`nano-staged`) routes staged files to the matching track.
- Turborepo drives every workspace task. The `:sdk` aliases filter to `./packages/*`, `build:web` filters to the website, and the unfiltered commands cover all four projects, so a website build pulls its SDK dependencies first through `dependsOn: ["^build"]`.

## Local environment

- Ignored env files: `apps/website/.env` (`VITE_WEB_SOCK`), `apps/playground-vue3/.env` (`VITE_WEILA_WSS`, `VITE_WEILA_APP_ID`, `VITE_WEILA_APP_KEY`), `packages/core/tests/integration/.env.integration` (`WEILA_TEST_*`), and `~/.voischat/env.sh` (`WEILA_QA_ACCOUNT`, `WEILA_QA_PASSWORD`, sourced from `~/.zshrc`; add `CLOUDFLARE_API_TOKEN` there if you mint one for local deploys).
- `pnpm env:setup` renders all four from 1Password (Personal vault, item `Weila Work env`): templates live in `env/*.env.template`, hold only `op://` secret references, and are safe to commit; outputs are written with mode 0600. Requires an unlocked 1Password desktop app, or `eval $(op signin)`.
- `packages/core/.env` deliberately does not exist. The SDK bundle must not embed app credentials; consumers pass `appId`/`appKey` to `weila_init`.
- Claude Code worktrees copy the three repo-level files through `.worktreeinclude`. Other worktree tools do not, so run `pnpm env:setup` inside a fresh worktree.
- The verification skills read `WEILA_QA_ACCOUNT` / `WEILA_QA_PASSWORD` from the environment; keep real values out of git.

## Commands

Run from the repo root.

| Command                        | What                                                            |
| ------------------------------ | --------------------------------------------------------------- |
| `pnpm dev`                     | website dev server                                              |
| `pnpm dev:prod`                | website dev server, production profile                          |
| `pnpm dev:sdk`                 | SDK packages and playground in dev/watch mode                   |
| `pnpm mock`                    | Void mock server for website API fixtures                       |
| `pnpm build`                   | turbo build for every workspace project                         |
| `pnpm build:sdk`               | turbo build limited to `packages/*`                             |
| `pnpm build:web`               | turbo build for the website and its workspace dependencies      |
| `pnpm typecheck`               | turbo typecheck for every workspace project                     |
| `pnpm typecheck:sdk`           | turbo typecheck limited to `packages/*`                         |
| `pnpm lint`                    | `lint:web`, `lint:sdk` and `lint:comments`                      |
| `pnpm test`                    | turbo test for every workspace project (website runs non-watch) |
| `pnpm test:run`                | turbo test:run for `packages/*`                                 |
| `pnpm knip`                    | unused files, exports, dependencies (must report zero findings) |
| `pnpm fmt` / `pnpm fmt:check`  | Oxfmt over everything except `apps/website`                     |
| `pnpm env:setup`               | render the ignored env files from 1Password                     |
| `pnpm release`                 | bump `apps/website`, commit and tag `vX.Y.Z`                    |
| `pnpm release:core`            | bump core, commit and tag `@vois/weila-sdk-core@X.Y.Z`          |
| `pnpm release:ui`              | bump UI, commit and tag `@vois/weila-sdk-ui@X.Y.Z`              |
| `pnpm docs:dev` / `docs:build` | VitePress user manual                                           |

## Gates

`.github/workflows/gates.yml` runs, for the SDK track: `fmt:check`, `manifests`, `build:sdk`, `api:snapshot`, `typecheck:sdk`, `typecheck:tsc:sdk`, `typecheck:parity`, `typecheck:strict-budget`, `knip`, `lint:sdk`, `lint:comments`, `test:scripts`, `test:sdk`, the Playwright dist smoke test, and `build:story`. The `web` job runs `lint:web` and then the website's turbo `typecheck`, `test` and `build`, which pull the SDK builds through the task graph.

`scripts/commit-hooks.spec.mjs` asserts the hook wiring, so changing `nano-staged` globs or the hook runner means updating that spec.

## Releases

Tags drive `.github/workflows/release.yml`. `vX.Y.Z` releases the console, `@vois/weila-sdk-core@X.Y.Z` and `@vois/weila-sdk-ui@X.Y.Z` publish those packages. The workflow checks the tag against the package version, builds, publishes with provenance using the `NPM_TOKEN` secret, and creates a GitHub Release with changelogithub. Console tags also build the website and attach `weila-work-web_X.Y.Z.tar.gz` (the contents of `apps/website/dist` at the archive root) for nginx deployments. Local `pnpm release`, `pnpm release:core` and `pnpm release:ui` run bumpp to bump, commit, tag and push. The UI package must not be released before the core version it depends on exists on npm, and `scripts/release/publish.ts` enforces that.

## Deployments

`.github/workflows/deploy.yml` builds and deploys all four sites on every push to `main`, using the `CLOUDFLARE_API_TOKEN` repo secret. `apps/website` and `apps/playground-vue3` deploy with `wrangler deploy`; their `wrangler.jsonc` pins the Worker name, account and assets directory, and `infra/cloudflare/proxy-worker.ts` serves the SPA while proxying `/v1/*` and `/v2/*` to `https://api.voischat.cn` so the same-origin API paths work in production. `packages/ui` (Storybook) and `docs` (VitePress) deploy with `void deploy --platform cloudflare --dir ... --skip-build`, naming their Worker in `void.config.ts`. Production only, no per-PR previews. Worker names are `work-web`, `work-playground`, `work-ui` and `work-docs` under the account's workers.dev subdomain.

## Skills

Agent skills live in `.claude/skills/`. The verification skills drive the real console through ego-browser; start `pnpm dev:prod` and read the `Local:` URL from its log instead of assuming a port. They read the QA account from `WEILA_QA_ACCOUNT` and `WEILA_QA_PASSWORD` in the environment (see `.env.example`); real credentials are never committed.
