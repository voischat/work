# AGENTS.md - Weila SDK Development Guide

## Project Overview

**微喇网页SDK (Weila Web SDK)** - A TypeScript-based SDK for Weila communication platform with WebSocket networking, audio processing, protobuf messaging, and IndexedDB storage.

**Package Manager**: pnpm (pnpm-lock.yaml in monorepo root)
**Build Tool**: Rspack 2 with SWC
**Language**: TypeScript (target: ESNext, strict mode: on through `tsconfig.base.json`)

---

## Build Commands

### Production Build

```bash
pnpm run build
```

Builds the worklet bundles first, then the four ESM entries with Rspack, then declarations with `tsc`. Output: `dist/weilasdk.mjs`, `dist/weilasdk_data.mjs`, `dist/weilasdk_log.mjs`, `dist/weilasdk.d.ts`, and `dist/worklets/*.iife.js`.

### Development Build

```bash
pnpm run build:dev
```

Builds the same artifacts in development mode with source maps, written to `dist`.

### Type Checking

```bash
pnpm run typecheck
pnpm run typecheck:tsc
```

`typecheck` runs `tsrs` and is the gate. `typecheck:tsc` runs the TypeScript compiler as a cross-check. The repo gates also run `typecheck:parity` and `typecheck:strict-budget`.

### Testing

Unit tests run with Vitest (`pnpm test`). The built bundle is smoke-tested in Chromium with Playwright (`pnpm test:dist`). The real-backend suite under `tests/integration` runs with `pnpm test:integration` and skips when `.env.integration` is absent.

---

## Project Structure

```
packages/core/
├── src/
│   ├── audio/          # Audio processing, Web Audio API, Opus encoding
│   ├── database/       # Dexie (IndexedDB) for local storage
│   ├── fsm/            # XState finite state machine definitions
│   ├── log/            # Logging utilities
│   ├── main/           # Core SDK logic, modules, networking
│   ├── proto/          # Protobuf message wrappers and utilities
│   ├── assets/         # Binary resources (WASM, audio files)
│   ├── weilasdk.ts     # Main SDK entry point
│   ├── weilasdk_data.ts
│   ├── weilasdk_log.ts
│   └── weila_compile_config.ts
├── dist/               # Build output (ESM bundles, assets, worklets)
├── tests/              # Dist smoke test and the real-backend integration suite
├── scripts/            # Lint and typecheck budget gates
├── docs/               # SDK documentation
├── tsconfig.json       # TypeScript configuration
├── rspack.config.mts   # Rspack build configuration
├── rspack.worklets.config.mts
└── worklet-inline-loader.ts
```

### Module Path Aliases

Configured in both `tsconfig.json` and `rspack.config.mts`:

- `fsm/*` → `src/fsm/*`
- `log/*` → `src/log/*`
- `main/*` → `src/main/*`
- `db/*` → `src/database/*`
- `proto/*` → `src/proto/*`
- `audio/*` → `src/audio/*`

**Always use these aliases** for imports within the project.

---

## Code Style Guidelines

### Naming Conventions

- **Variables/Functions**: `camelCase` (e.g., `weila_init`, `sendPbMsg`, `processSendingPbMsg`)
- **Classes/Interfaces/Types**: `PascalCase` (e.g., `WeilaCore`, `WL_IDbUserInfo`, `WLPlayerState`)
- **Constants/Enums**: `SCREAMING_SNAKE_CASE` (e.g., `WL_DB_MSG_DATA_STATUS_ERR`)
- **Prefixes**: Weila-specific types/interfaces use `WL_` prefix (e.g., `WL_PbMsgData`, `WL_LoginParam`)

### Import Organization

Organize imports in this order (do NOT alphabetize within groups):

1. **External libraries** (npm packages like 'xstate', 'dexie', 'long')
2. **Internal types/interfaces** (grouped by source file)
3. **Internal modules** (using path aliases like 'main/', 'proto/', 'db/')

Example:

```typescript
// External libraries
import { interpret } from 'xstate'
import Long from 'long'

// Internal types
import { WL_CoreInterface, WL_LoginParam, WL_LoginResult } from 'main/weila_internal_data'

// Internal modules
import { createLogger } from 'log/weila_log'
import { WLConfig } from 'main/weila_config'
```

### TypeScript Style

- **Explicit typing**: Always provide type annotations for function parameters and return types
- **Interfaces over types**: Use `interface` for object shapes, reserve `type` for unions/intersections
- **No implicit any**: Strict mode is on, so an implicit `any` fails the gate
- **Generics**: Use for collections (`Promise<boolean>`, `Map<number, T>`)
- **No type suppression**: Avoid `as any` and `@ts-ignore`. Declare loader-produced modules in `src/loader-modules.d.ts` instead.

### Function Declarations

- **Class methods**: Use `function` keyword with visibility modifiers (`public`, `private`)
- **Callbacks/inline functions**: Use arrow functions
- **Async operations**: Prefer `async/await` over raw Promises

Example:

```typescript
// Class method
public async weila_init(): Promise<boolean> {
    // ...
}

// Callback
callback.resolve = (value: any) => {
    // ...
};
```

### Error Handling

- **try/catch**: Wrap async operations and potential failures
- **Error logging**: Use `log.error()` (from log module) before rejecting/throwing
- **Promise rejection**: Return `Promise.reject(new Error(message))` for async failures
- **Error message format**: Structured strings like `"RET_CODE:${code}-MESSAGE:${msg}:END"`
- **No custom error classes**: Use standard `Error` objects

Example:

```typescript
try {
  await WLConfig.loadResource()
  callback.resolve(true)
} catch (e) {
  log.error('加载数据失败', e)
  callback.reject(e)
}
```

### Comments

The repository's `no-comments` lint rule allows only tool directives, legal headers, `SAFETY:` rationale and bare links. Put the reason in the code or the commit message instead of a comment.

### Lint Overrides

Four file-scoped override blocks in `oxlint.config.ts` cover boundaries the rules cannot express:

- `weila_core.ts` and `weila_audio.ts` import worker and worklet modules whose default export exists only after the Rspack loader runs.
- `weila_pb_dispatcher.ts` stores promise resolvers whose response type is chosen by the awaiting module.
- `db_enum.ts` restores the caller-chosen numeric enum label.
- `weila_type_guards.ts` returns a caller-chosen callable result type.

Keep each override scoped to its file. Do not add inline `oxlint-disable` comments.

---

## Special Considerations

### Web Workers

- Worker files use `.worker.ts` suffix (e.g., `weila_network.worker.ts`)
- Import `main/weila_network.worker` directly. The module declaration lives in `src/loader-modules.d.ts`.
- Configured with `worker-rspack-loader` in `rspack.config.mts` and inlined as a Blob

### Worklets (Audio)

- Worklet files use `.worklet.js` suffix
- `rspack.worklets.config.mts` builds each worklet as a standalone IIFE, and `worklet-inline-loader.ts` embeds the result as a Blob URL factory

### Binary Assets

- WASM files (`.wasm`) and audio files (`.wav`) loaded as `asset/resource`
- Placed in `src/assets/` directory
- Rspack outputs to `dist/assets/[name][ext]` with no content hash, so consumers can copy the directory

### Environment Variables

- `rspack.config.mts` reads optional `APPID`, `APPKEY` and `WSS` values from a gitignored `.env`, then injects them with `rspack.DefinePlugin`
- The file does not exist by default. The SDK must not embed app credentials, so consumers pass `appId` and `appKey` to `weila_init`.
- Access the injected values through `process.env.VARIABLE_NAME`

---

## Integration Guidelines

### For VUE 2/3 Projects

- Use `markRaw()` to wrap WeilaCore instance (avoid Proxy wrapping)
- Import dynamically: `const weilaModule = await import('weilasdk');`
- Initialize logger: `setLogLevel('debug');`

### For UniApp Projects

1. Copy `public/assets/` resources to `static/weilasdk/`
2. Call `setConfigData()` before WeilaCore initialization to remap asset paths
3. Add a bundler rule for `.wasm` files using asset modules

### Proxy Configuration

Required API endpoints:

- `/v1` → `http://webapi.weila.hk:8080/`
- `/audio` → `https://weilaaudio.oss-cn-shenzhen.aliyuncs.com`
- `/avatar` → `https://weilaavatar.oss-cn-shenzhen.aliyuncs.com`
- `/ptt` → `https://weilaspeech.oss-cn-shenzhen.aliyuncs.com`

---

## Common Tasks

### Adding New Modules

1. Create module file in `src/main/` (e.g., `weila_new_module.ts`)
2. Define a module class that takes `WL_CoreInterface` and registers its service handler in the constructor
3. Import and initialize in `weila_core.ts`
4. Export public API in module and re-export in `weilasdk.ts`

### Updating Protobuf Definitions

1. Modify proto files in `src/proto/proto_raws/`
2. Regenerate `weilapb.js` and `weilapb.d.ts` with protobuf compiler
3. Update wrappers in `src/proto/weilapb_*_wrapper.ts` if message structure changed

### Adding Database Tables

1. Define interface in `src/database/weila_db_data.ts` (prefix with `WL_IDb`)
2. Add table schema in `src/database/weila_db.ts` (extend WeilaDB class)
3. Use Dexie API for queries (`.where()`, `.toArray()`, `.put()`, etc.)

---

## Verification Checklist

Before committing changes, run these from the repo root:

- [ ] `pnpm run typecheck:sdk` and `pnpm run typecheck:tsc:sdk` pass
- [ ] `pnpm run lint:sdk` reports 0 errors and stays within the warning budget
- [ ] `pnpm run test:sdk` passes
- [ ] `pnpm run build:sdk` succeeds
- [ ] No `@ts-ignore` or `as any` added
- [ ] Public APIs are exported from the entry points
- [ ] Import paths use configured aliases, not relative `../../` paths
- [ ] Failures are logged with `log.error()`
- [ ] No `console.log`; use `createLogger` from `log/weila_log`
