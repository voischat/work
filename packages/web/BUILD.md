# 桌面端（Electron）打包说明

内嵌 AI 助手（eve agent）的微喇企业管理台桌面版打包指南。涵盖工具链、流水线、验收，以及**问题定位**（末尾「常见问题定位」章节）。

## 为什么构建机无关

内嵌的 AI 助手（eve agent）在**生产环境运行的是预构建产物 `.output`**（由 `eve build` 产出，纯 JS、平台中立），而不是开发用的 `eve dev`。
随包的 `node_modules` 也只保留运行期真正需要的纯 JS 依赖（`weila-work-cli` → `cac` / `md5` / `unstorage`）。
`scripts/prepare-agent.cjs` 会裁掉一切仅构建期使用的工具链与原生件（rolldown / rollup / esbuild / lightningcss / better-sqlite3 / microsandbox / fsevents 等），并体检确保产物里**没有任何 `.node` 原生二进制**。

因此本包**在 macOS / Linux / Docker / Windows 任意平台构建，都能产出可在 Windows 运行的 agent**，不会再出现“mac 二进制被塞进 Windows 包导致 agent 起不来”的问题。

> 背景：历史上曾在 mac 上交叉打 Windows 包，`pnpm deploy --prod` 把 darwin-arm64 原生件拷进了 Windows 包，`eve dev` 在 Windows 上加载 `*-win32-x64-msvc` 绑定失败 → agent 进程崩 → `127.0.0.1:2000` 无人监听 → 前端 `POST /eve/v1/session` 报 `ERR_CONNECTION_REFUSED`。

## 工具链要求

工具版本由根目录 `mise.toml` 固定：

| 工具 | 版本 |
|------|------|
| node | lts（当前解析为 24.18.0，agent 要求 `>=24`） |
| pnpm | 10.20.0 |

**注意（Windows 常踩坑）**：如果当前 shell 没有激活 mise，直接敲 `pnpm` 可能会走 Node 自带的 corepack 去联网下载 pnpm，并在旧版 Node 下报签名校验失败：

```
Error: Cannot find matching keyid: {...}
```

解决办法二选一：

```bash
# 方式 A：激活 mise（推荐，之后 pnpm/node 都用对版本）
mise activate

# 方式 B：每条命令都用 mise 指定的工具链
mise exec -- pnpm ...
mise exec -- node scripts/prepare-agent.cjs
```

不要用 corepack 那个 shim 的 pnpm。

## 依赖与目录

SDK（`@vois/weila-sdk-core`、`@vois/weila-sdk-ui`、`@wl/network`）现在都从 **npm** 安装，**不再需要**把 `weila-js-sdk` 与本仓库同级签出。装依赖即可：

```bash
pnpm install
```

## 构建命令

```bash
# 完整打包（按 electron-builder.yml：win=x64 dir、mac=arm64 dir）
pnpm --filter weila-work-web run electron:build

# 只打 unpacked 目录（--dir，最快，适合本地验证，不生成安装器）
pnpm --filter weila-work-web run electron:build:dir

# 开发态直接跑（连 vite dev server + pnpm run dev 拉起 agent）
pnpm --filter weila-work-web run electron
```

> 如未激活 mise，把上面命令包一层：`mise exec -- pnpm --filter weila-work-web run electron:build:dir`。

## 流水线拆解（`electron:build` 依次执行）

### 1. `node scripts/prepare-agent.cjs` —— 产出 `packages/agent-deploy/`

1. **强制干净重建 agent**：先删 `packages/agent` 的 `.output`、`.eve`、`node_modules/.cache/eve`，再 `eve build` → 产出 `.output`（纯 JS server，生产直接跑它）；校验 `.output/server/index.mjs` 存在。清缓存是为了杜绝 eve 增量缓存把旧编译产物打进包（见问题定位 #8）。
2. **`pnpm run build`（在 `packages/cli`）→ 产出 `dist/cli.mjs`**。`weila-work-cli` 是 agent 的 workspace 依赖，`pnpm deploy` 只拷贝它的 `files: ["dist"]`；不先构建则打包后的 CLI 只有 `package.json`/`README`，运行期 agent 调用会失败（见问题定位 #2）。
3. **清理 pnpm deploy 的伪嵌套残留**（`packages/agent/packages`、`agent-deploy/agent-deploy`、`agent-deploy/packages`），deploy 前后各清一次，保证幂等（见问题定位 #1）。
4. `pnpm --filter weila-work-agent deploy --legacy --prod agent-deploy` → 拷贝运行期依赖。
5. 把 `.output` 拷进 `agent-deploy/.output`。
6. 裁掉仅构建期 / 原生件，并体检：无任何 `.node`（打印「产物体检通过」）。
7. 写 `agent-deploy/.env`（取 `packages/agent/.env`，否则写 `DEEPSEEK_API_KEY=<env 或空>`）。

### 2. `vite build` —— 产出 `dist/`

两个入口：`index.html`（main）与 `corp-manager/index.html`。

### 3. `node scripts/fix-electron-build.cjs`

从 `dist/**/*.html` 里剥掉 `crossorigin` / `integrity` / CSP `upgrade-insecure-requests`，让 Electron `loadFile` 能正常加载。

### 4. `electron-builder`（读 `electron-builder.yml`）

- 从 `cdn.npmmirror.com` 下载对应平台 electron 二进制（首次约 148MB）。
- `extraResources` 把 `agent-deploy` 拷进 `resources/agent`（含 `.output/**`、`node_modules/**`、`.env*` 等）。
- 无自签名证书时跳过签名（`dir` 目标正常现象）。
- 未配置图标时用 electron 默认图标（`dir` 验证阶段可忽略）。

**产物**：`release/<version>/`（`win-unpacked/`、`mac-arm64/`）。`<version>` 取 `packages/web/package.json` 的 `version`（当前 `3.1.1`）。Windows 可执行文件为 `release/<version>/win-unpacked/微喇企业管理台.exe`。

## 运行期架构（`electron/main.cjs`）

- **agent 子进程**：生产环境用 `process.execPath`（即 electron 本体，带 `ELECTRON_RUN_AS_NODE=1`）运行 `resources/agent/.output/server/index.mjs`，监听 `http://127.0.0.1:2000`（`AGENT_HOST`）。启动后轮询 `/eve/v1/health`，最多等 30s；失败会弹「AI 助手启动失败」错误框并附最近日志（`reportAgentFailure`）。
- **窗口**：生产加载 `dist/index.html`；开发加载 `WEILA_DEV_SERVER_URL`（默认 `https://localhost:5173`）。
- **CLI 工具调用**：`packages/agent/agent/lib/run-cli.ts` 用 `import.meta.resolve('weila-work-cli')` 定位包，再拼 `dist/cli.mjs`，同样以 electron-as-node 起子进程执行。
- 端口占用：若 `127.0.0.1:2000` 已有 agent 在跑，main 进程会直接复用、不再拉起新的。

## 验收检查

打包后：

- `resources/agent/.output/server/index.mjs` 存在；
- `resources/agent/node_modules` 下**无 `.node` 文件**、无 `weila-work-cli-*` 单可执行文件（prepare-agent 会打印「产物体检通过」）；
- `resources/agent/node_modules/.../weila-work-cli/dist/cli.mjs` 存在（CLI 已随包）。

启动验证：

```bash
cd release/<version>/win-unpacked
./微喇企业管理台.exe        # 启动 app

# 另开一个终端：agent 健康检查应返回 {"ok":true,"status":"ready",...}
curl -sS http://127.0.0.1:2000/eve/v1/health

# 验证随包 CLI 能在 electron 的 node 运行时里执行（agent 工具调用走的就是这条路）
ELECTRON_RUN_AS_NODE=1 ./微喇企业管理台.exe \
  resources/agent/node_modules/.pnpm/weila-work-cli@*/node_modules/weila-work-cli/dist/cli.mjs --help
```

- app 日志出现 `[electron] agent ready` 与 `[electron] loaded index.html` 即为正常；
- 与 AI 助手对话时，`POST http://127.0.0.1:2000/eve/v1/session` 返回 200、流式回复正常（需 `.env` 配了真实 `DEEPSEEK_API_KEY`）。

## 常见问题定位

### 1. `pnpm deploy` 报 `EPERM: operation not permitted, open '...\.bin\eve'`（Windows）

`pnpm --filter ... deploy` 会在被过滤包目录下额外生成一份**伪嵌套副本** `packages/agent/packages/agent-deploy`。上一次打包残留的 bin shim（`eve.CMD` / `eve.ps1` …）会让本次 deploy 写 `.bin/eve` 时 EPERM 失败。
`prepare-agent.cjs` 已在 deploy 前后清理这些伪目录。若仍复现（例如手动跑过 deploy），手动清一遍再重打：

```bash
rm -rf packages/agent/packages packages/agent-deploy
```

### 2. 打包后 AI 工具调用失败 / 找不到 `weila-work-cli` 的 `dist/cli.mjs`

`weila-work-cli` 的 `dist` 从未构建时，deploy 出来只有 `package.json`/`README`，运行期 `import.meta.resolve` 定位的 `dist/cli.mjs` 缺失。
`prepare-agent.cjs` 已在 deploy 前构建 CLI。核对随包产物：

```bash
find release/<version>/win-unpacked/resources/agent/node_modules -path '*weila-work-cli*' -name 'cli.mjs'
```

### 3. `pnpm` 报 corepack `Cannot find matching keyid`

shell 没走 mise 工具链、落到了 corepack 下载 pnpm。见「工具链要求」，改用 `mise activate` 或 `mise exec -- pnpm ...`。

### 4. `node_modules/electron/dist` 为空 / `pnpm electron` 找不到 electron 本体

pnpm 10 默认拦截依赖的 postinstall（electron 的下载脚本没跑）。**打包不受影响**：electron-builder 会自行从 mirror 下载 electron 二进制。只有本地 `pnpm electron`（开发态直跑）才需要 electron 本体：

```bash
pnpm approve-builds        # 放行 electron 的 build 脚本
pnpm rebuild electron      # 触发下载 dist
```

### 5. agent 起不到 / 健康检查 30s 超时（app 弹「AI 助手启动失败」）

按错误框里的日志尾部排查。先核对随包资源是否完整：`resources/agent/.env`、`resources/agent/.output/server/index.mjs` 是否存在。也确认 `127.0.0.1:2000` 没被别的进程占。

### 6. 健康检查过了、但 AI 不回复

`resources/agent/.env` 里 `DEEPSEEK_API_KEY` 为空。agent 服务能起、健康检查能过，但没 key 不会真正回复。构建前在 `packages/agent/.env` 配好 `DEEPSEEK_API_KEY`（会被 prepare-agent 带进包），或设同名环境变量。

### 7. electron 二进制下载慢 / 被墙

`electron-builder.yml` 的 `electronDownload.mirror` 已指向 `cdn.npmmirror.com`。若仍失败，检查网络或临时换镜像。

### 8. 改了 agent 源码、跑了 `electron:build`，打包后 agent 还是旧的

eve 有增量编译缓存（`packages/agent/node_modules/.cache/eve`、`.eve`）。个别情况下缓存未完全失效，`eve build` 会复用旧编译产物 → 打进包的还是旧 agent。
`prepare-agent.cjs` 已在每次 `eve build` 前清掉 `.output` / `.eve` / `node_modules/.cache/eve`，强制从零编译。若手动跑 `eve build` 遇到同样问题，先清一遍：

```bash
rm -rf packages/agent/.output packages/agent/.eve packages/agent/node_modules/.cache/eve
```
