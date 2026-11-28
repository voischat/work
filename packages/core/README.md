# @vois/weila-sdk-core

微喇 Web SDK。WebSocket、protobuf 消息、音频、IndexedDB 会话存储。

## 安装

从 GitHub Release 下载 `vois-weila-sdk-core-X.Y.Z.tgz` 后安装：

```bash
pnpm add ./vois-weila-sdk-core-2.0.1.tgz
```

## 初始化

```ts
import { WeilaCore } from '@vois/weila-sdk-core'

const core = new WeilaCore()
await core.weila_init({ appId, appKey, webSock })
```

## 资源

运行时从站点根目录请求 `/assets/opuslibs.wasm` 和四个铃声 `/assets/*.wav`。把 `node_modules/@vois/weila-sdk-core/dist/assets` 复制到站点的 `assets` 目录，或在初始化前用 `setConfigData` 重映射全部五个资源。

```ts
import { setConfigData, WL_ConfigID } from '@vois/weila-sdk-core'

setConfigData([
  { id: WL_ConfigID.WL_RES_DATA_OPUS_WASM_ID, url: '/assets/opuslibs.wasm', version: 1 },
  { id: WL_ConfigID.WL_RES_RING_START_PLAY_ID, url: '/assets/start_player.wav', version: 1 },
  { id: WL_ConfigID.WL_RES_RING_STOP_PLAY_ID, url: '/assets/stop_player.wav', version: 1 },
  { id: WL_ConfigID.WL_RES_RING_START_RECORD_ID, url: '/assets/start_record.wav', version: 1 },
  { id: WL_ConfigID.WL_RES_RING_STOP_RECORD_ID, url: '/assets/stop_record.wav', version: 1 },
])
```

## 文档

- [SDK 使用文档](https://github.com/voischat/work/blob/main/packages/core/docs/WEILA_SDK_DOCUMENTATION.md)

## License

专有软件，详见 [LICENSE](./LICENSE)。
