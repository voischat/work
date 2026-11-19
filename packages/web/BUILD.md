# 桌面端（Electron）打包说明

内嵌 AI 助手（eve agent）的微喇企业管理台桌面版打包指南。涵盖工具链、流水线、验收，以及**问题定位**（末尾「常见问题定位」章节）。

## 为什么构建机无关 / 自包含

生产环境运行的是两个**零外部依赖的预构建 bundle**：

- **agent server**：`eve build` 产出的 `.output`（nitro server bundle，`_libs` 已内联全部依赖，平台中立纯 JS），不是开发用的 `eve dev`。
- **weila-work-cli**：tsdown `noExternal` 把 `cac`/`md5`/`unstorage`/`@wl/network` 全部打进 `dist`，运行期零外部 npm 依赖。

因此随包的 `agent-deploy` 只需 `.output` + `node_modules/weila-work-cli`（CLI bundle）+ `.env`，**不含任何第三方依赖包、无软链接、无 `.node` 原生件**（`prepare-agent.cjs` 会体检断言）。

好处：

- **构建机无关**：在 macOS / Linux / Docker / Windows 任意平台构建，都能产出可在 Windows 运行的 agent，不会出现“mac 二进制被塞进 Windows 包”的问题。
- **可分发**：产物压缩/解压/拷到别的机器都能跑，不再有“缺 unstorage/md5/… 依赖”这类问题。

> 背景：历史上曾用 `pnpm deploy --prod` 拷运行期依赖，既把平台原生件带进包（`eve dev` 在 Windows 加载 `*-win32-x64-msvc` 失败 → agent 崩），又因 pnpm 软链接不自包含导致压缩/换机器后缺依赖。现在改为“两个自包含 bundle + 最小扁平组装”，从根上消除这两类问题。

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
# 完整打包（按 electron-builder.yml：win=x64 NSIS 安装包、mac=arm64 dir）
pnpm --filter weila-work-web run electron:build

# 只打 unpacked 目录（--dir，最快，适合本地验证，不生成安装包）
pnpm --filter weila-work-web run electron:build:dir

# 开发态直接跑（连 vite dev server + pnpm run dev 拉起 agent）
pnpm --filter weila-work-web run electron
```

> 如未激活 mise，把上面命令包一层：`mise exec -- pnpm --filter weila-work-web run electron:build:dir`。

## 流水线拆解（`electron:build` 依次执行）

### 1. `node scripts/prepare-agent.cjs` —— 组装最小自包含 `packages/agent-deploy/`

运行期只需两样**零外部依赖**的预构建 bundle，所以 agent-deploy 做成最小扁平结构，**不用 pnpm deploy、无软链接、无 prune、无解引用**：

1. **强制干净重建 agent**：先删 `packages/agent` 的 `.output`、`.eve`、`node_modules/.cache/eve`，再 `eve build` → 产出 `.output`（nitro server bundle，`_libs` 已内联全部依赖，自包含）；校验 `.output/server/index.mjs` 存在。清缓存是为了杜绝 eve 增量缓存把旧编译产物打进包（见问题定位 #8）。
2. **构建自包含 CLI**：`pnpm run build`（在 `packages/cli`，tsdown `noExternal` 把 `cac`/`md5`/`unstorage`/`@wl/network` 全部打进 bundle）→ `dist/cli.mjs` **零外部 npm 依赖**（只用 Node 内置）。
3. **组装 agent-deploy**（全真实文件）：
   - `.output/` ← 拷 `packages/agent/.output`；
   - `node_modules/weila-work-cli/{package.json,dist}` ← 拷 CLI 包（供运行期 `import.meta.resolve('weila-work-cli')` 定位）；
   - `.env` ← 取 `packages/agent/.env`，否则写 `DEEPSEEK_API_KEY=<env 或空>`。
4. **体检**：0 软链接 + 0 `.node` + `weila-work-cli/dist/cli.mjs` 就位，否则报错中断。

> 因为两个 bundle 都自包含，agent-deploy 里**不含任何第三方依赖包**（`node_modules` 下只有 `weila-work-cli` 自己），产物 ~6MB、无软链接，压缩/拷贝/换机器都能跑，从根上消除“打包后缺 unstorage/md5/… 依赖”这类问题（见问题定位 #9）。

### 2. `vite build` —— 产出 `dist/`

单一入口：`index.html`（main）。

### 3. `node scripts/fix-electron-build.cjs`

从 `dist/**/*.html` 里剥掉 `crossorigin` / `integrity` / CSP `upgrade-insecure-requests`，让 Electron `loadFile` 能正常加载。

### 4. `electron-builder`（读 `electron-builder.yml`）

- 从 `cdn.npmmirror.com` 下载对应平台 electron 二进制（首次约 148MB）。
- Windows 目标为 **`nsis`**，产出安装包；NSIS 工具链首次会从 GitHub（electron-builder-binaries）下载。
- `extraResources` 把 `agent-deploy` 拷进 `resources/agent`（`.output/**`、`node_modules/**`、`.env*`）。第 1 步已做成全真实文件、无软链接。
- 无自签名证书时跳过签名（正常现象）。
- 未配置图标时用 electron 默认图标（验证阶段可忽略）。

**产物**：
- Windows：`release/<version>/WeilaWork-<version>-win-x64-setup.exe`（NSIS 安装包，分享用这个）+ 中间 `release/<version>/win-unpacked/`。
- mac：`release/<version>/mac-arm64/`（仍是 dir 目标）。

`<version>` 取 `packages/web/package.json` 的 `version`（当前 `3.1.1`）。

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
  resources/agent/node_modules/weila-work-cli/dist/cli.mjs --help
```

- app 日志出现 `[electron] agent ready` 与 `[electron] loaded index.html` 即为正常；
- 与 AI 助手对话时，`POST http://127.0.0.1:2000/eve/v1/session` 返回 200、流式回复正常（需 `.env` 配了真实 `DEEPSEEK_API_KEY`）。

## 常见问题定位

### 1. （历史）`pnpm deploy` 的 EPERM / 伪嵌套残留 / CLI dist 缺失

这些问题都来自早期用 `pnpm --filter weila-work-agent deploy` 拷运行期依赖的做法。现在 `prepare-agent.cjs` 已改为**组装最小自包含 agent-deploy**（不再跑 pnpm deploy），这一整类问题（`.bin/eve` EPERM、`packages/agent/packages` 伪嵌套残留、deploy 出的 CLI 只有 package.json）都不复存在。若在旧分支遇到，升级到当前 `prepare-agent.cjs` 即可。

### 2. 打包后 AI 工具调用失败 / 找不到 `weila-work-cli` 的 `dist/cli.mjs`

`prepare-agent.cjs` 会构建 CLI 并把 `package.json` + `dist` 拷进 `agent-deploy/node_modules/weila-work-cli`，且体检断言 `dist/cli.mjs` 存在。核对随包产物：

```bash
ls release/<version>/win-unpacked/resources/agent/node_modules/weila-work-cli/dist/cli.mjs
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

### 9. 压缩/拷贝/换机器后运行报 `Cannot find package 'unstorage'` / `'md5'` 等（所有 weila_cli 命令失败）

历史根因：早期 `pnpm deploy` 出的 `agent-deploy/node_modules` 是 pnpm 软链接结构（指向构建机的绝对软链接），electron-builder 原样搬运。本机能跑，但压缩/解压（软链接失效）或换机器后 Node 找不到 CLI 的运行期依赖，且是“缺一个补一个”（unstorage→md5→…）。
**现已根治**：`weila-work-cli` 用 tsdown `noExternal` 把所有依赖打进 `dist`（零外部 npm 依赖），`.output` 本就自包含；agent-deploy 只放这两个 bundle + `.env`，`node_modules` 下仅一个 `weila-work-cli`、无软链接、无第三方依赖。核对：

```bash
find release/<version>/win-unpacked/resources/agent -type l | wc -l                    # 0
ls release/<version>/win-unpacked/resources/agent/node_modules                          # 只有 weila-work-cli
```

> 分享请直接发 NSIS 安装包 `WeilaWork-<version>-win-x64-setup.exe`（自包含，装到哪台机器都能跑）。
