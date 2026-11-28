# @vois/weila-sdk-ui

集成了 Weila SDK 的 Vue 3 组件库。

## 安装

从 GitHub Release 下载 `vois-weila-sdk-ui-X.Y.Z.tgz` 后安装，并把对应的 `@vois/weila-sdk-core` tarball 一起安装：

```bash
pnpm add ./vois-weila-sdk-core-2.0.1.tgz ./vois-weila-sdk-ui-0.0.3.tgz
```

## 构建工具

使用 [tsdown](https://tsdown.dev/) 构建，配合 [unplugin-vue](https://github.com/unplugin/unplugin-vue) 编译 `.vue` 单文件组件，通过 [rolldown-plugin-dts](https://github.com/sxzz/rolldown-plugin-dts)（`vue: true`）+ `vue-tsc` 生成类型声明。

## 命令

```bash
# 构建
pnpm --filter @vois/weila-sdk-ui run build

# 监听模式（开发）
pnpm --filter @vois/weila-sdk-ui run dev

# 类型检查
pnpm --filter @vois/weila-sdk-ui run typecheck
```

## 输出

构建产物位于 `dist/`：

| 文件          | 说明                         |
| ------------- | ---------------------------- |
| `index.js`    | ESM 格式                     |
| `index.cjs`   | CJS 格式                     |
| `index.css`   | 提取的样式                   |
| `index.d.ts`  | ESM 类型声明                 |
| `index.d.cts` | CJS 类型声明                 |
| `i18n.js`     | `createWeilaUi` 等 i18n 入口 |
| `i18n.d.ts`   | i18n 入口的类型声明          |

## 使用方式

```vue
<script setup lang="ts">
import { WlStatusIndicator } from '@vois/weila-sdk-ui'
import '@vois/weila-sdk-ui/index.css'
</script>

<template>
  <WlStatusIndicator status="connected" />
</template>
```

## 多语言配置

组件库默认使用 `zh-CN`，即使没有安装插件也能正常显示中文。宿主应用可以通过插件设置语言；只需要 i18n 时从 `@vois/weila-sdk-ui/i18n` 导入，避免把整套组件拉进入口包：

```ts
import { createApp } from 'vue'
import { createWeilaUi } from '@vois/weila-sdk-ui/i18n'
import App from './App.vue'

createApp(App)
  .use(createWeilaUi({ locale: 'en' }))
  .mount('#app')
```
