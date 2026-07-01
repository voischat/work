# 桌面端（Electron）打包说明

## 为什么构建机无关

内嵌的 AI 助手（eve agent）在**生产环境运行的是预构建产物 `.output`**（由 `eve build` 产出，纯 JS、平台中立），而不是开发用的 `eve dev`。
随包的 `node_modules` 也只保留运行期真正需要的纯 JS 依赖（`weila-work-cli` → `cac` / `md5` / `unstorage`）。
`scripts/prepare-agent.cjs` 会裁掉一切仅构建期使用的工具链与原生件（rolldown / rollup / esbuild / lightningcss / better-sqlite3 / microsandbox / fsevents 等），并体检确保产物里**没有任何 `.node` 原生二进制**。

因此本包**在 macOS / Linux / Docker / Windows 任意平台构建，都能产出可在 Windows 运行的 agent**，不会再出现“mac 二进制被塞进 Windows 包导致 agent 起不来”的问题。

> 背景：历史上曾在 mac 上交叉打 Windows 包，`pnpm deploy --prod` 把 darwin-arm64 原生件拷进了 Windows 包，`eve dev` 在 Windows 上加载 `*-win32-x64-msvc` 绑定失败 → agent 进程崩 → `127.0.0.1:2000` 无人监听 → 前端 `POST /eve/v1/session` 报 `ERR_CONNECTION_REFUSED`。

## 目录要求

`weila-work/` 与 `weila-js-sdk/` 需**同级签出**（web 通过 `link:../../../weila-js-sdk/packages/*` 引用 SDK 源码）：

```
<workspace>/
├── weila-work/
└── weila-js-sdk/
```

## 构建步骤

```bash
# 1. 安装依赖（两个仓库）
cd weila-js-sdk && pnpm install
cd ../weila-work && pnpm install

# 2. 构建 SDK（@vois/weila-sdk-core、@vois/weila-sdk-ui）
cd ../weila-js-sdk && pnpm -r build   # 或按 SDK 仓库的构建脚本

# 3. 打 Electron 包（默认 electron-builder.yml 中 mac=arm64 dir、win=x64 dir）
cd ../weila-work && pnpm --filter weila-work-web run electron:build
```

`electron:build` 内部依次执行：
1. `scripts/prepare-agent.cjs` —— `pnpm deploy --prod` + `eve build` 产出 `.output` + 裁原生件 + 产物体检；
2. `vite build` —— 构建 web 前端；
3. `scripts/fix-electron-build.cjs` —— 清理 CSP/crossorigin/integrity；
4. `electron-builder` —— 打包，`extraResources` 把 `agent-deploy` 拷进 `resources/agent`（含 `.output/**`）。

产物在 `release/<version>/`（`win-unpacked/`、`mac-arm64/`）。

## 验收检查

- `resources/agent/.output/server/index.mjs` 存在；
- `resources/agent/node_modules` 下**无 `.node` 文件**、无 `weila-work-cli-*` 单可执行文件（prepare-agent 会打印 “产物体检通过”）；
- 启动 app → 与 AI 助手对话，`POST http://127.0.0.1:2000/eve/v1/session` 返回 200、流式回复正常；
- 若 agent 启动失败，app 会弹出「AI 助手启动失败」错误框并附最近日志（见 `electron/main.cjs` 的 `reportAgentFailure`）。
