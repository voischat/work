<script setup lang="ts">
import { useQRCode } from '@vueuse/integrations/useQRCode'
import LogoURL from '~/assets/logo.png'

definePage({
  meta: {
    layout: 'empty',
    requiresAuth: false,
  },
})
const { t } = useI18n()

// 获取当前网站根地址
const baseUrl = typeof window !== 'undefined'
  ? window.location.origin
  : ''
// 生成二维码
const qrcode = useQRCode(baseUrl)

// 下载链接
const androidUrl = 'https://fir.xcxwo.com/tkdgb9yj'
const iosUrl = 'https://apps.apple.com/cn/app/%E5%BE%AE%E5%96%87%E4%BC%81%E4%B8%9A%E7%89%88/id6751869184'

function goTo(url: string) {
  window.open(url, '_blank')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 导航栏 -->
    <nav class="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
      <div class="container mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <img
            :src="LogoURL"
            alt="Logo"
            class="w-8 h-8 object-contain"
          >
          <span class="text-lg font-semibold text-gray-800 dark:text-white">
            {{ t('project-name') }}
          </span>
        </div>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('mobile.app-download') }}
        </div>
      </div>
    </nav>

    <!-- 主要内容 -->
    <main class="container mx-auto px-4 py-8">
      <!-- 标题 -->
      <div class="text-center mb-10">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-3">
          {{ t('mobile.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {{ t('mobile.description') }}
        </p>
      </div>

      <div class="max-w-4xl mx-auto">
        <!-- 二维码区域 -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 md:p-6 mb-6">
          <div class="flex flex-col md:flex-row items-center gap-4 md:gap-6">
            <div class="flex-shrink-0">
              <div class="bg-white p-3 rounded-lg shadow-inner relative">
                <img
                  :src="qrcode"
                  alt="Website QR Code"
                  class="size-40"
                >
                <!-- Logo overlay in center of QR code -->
                <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div class="bg-white rounded-md p-0.5 shadow-sm">
                    <img
                      :src="LogoURL"
                      alt="Logo"
                      class="size-6 object-contain"
                    >
                  </div>
                </div>
              </div>
              <p class="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                {{ t('mobile.qr-code-label') }}
              </p>
            </div>

            <div class="flex-1">
              <ul class="space-y-2 text-gray-600 dark:text-gray-300 text-sm">
                <li class="flex items-start">
                  <i i-ph-check-circle class="text-green-500 mt-0.5 mr-2 flex-shrink-0 text-sm" />
                  <span>{{ t('mobile.qr-code-benefit-1') }}</span>
                </li>
                <!-- <li class="flex items-start">
                  <i i-ph-check-circle class="text-green-500 mt-0.5 mr-2 flex-shrink-0 text-sm" />
                  <span>{{ t('mobile.qr-code-benefit-2') }}</span>
                </li>
                <li class="flex items-start">
                  <i i-ph-check-circle class="text-green-500 mt-0.5 mr-2 flex-shrink-0 text-sm" />
                  <span>{{ t('mobile.qr-code-benefit-3') }}</span>
                </li>
                <li class="flex items-start">
                  <i i-ph-check-circle class="text-green-500 mt-0.5 mr-2 flex-shrink-0 text-sm" />
                  <span>{{ t('mobile.qr-code-benefit-4') }}</span>
                </li> -->
              </ul>
            </div>
          </div>
        </div>

        <!-- 下载按钮区域 -->
        <!-- Mobile: Simple buttons only -->
        <div class="md:hidden space-y-4 mb-6">
          <a
            :href="androidUrl"
            target="_blank"
            class="flex items-center justify-center w-full bg-green-500 text-white hover:bg-green-600 font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
            @click="goTo(androidUrl)"
          >
            <i i-ph-android-logo class="mr-3 text-xl" />
            {{ t('mobile.android.button') }}
          </a>

          <a
            :href="iosUrl"
            target="_blank"
            class="flex items-center justify-center w-full bg-orange-500 text-white hover:bg-orange-600 font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
            @click="goTo(iosUrl)"
          >
            <i i-ph-apple-logo class="mr-3 text-xl" />
            {{ t('mobile.ios.button') }}
          </a>
        </div>

        <!-- Desktop: Full card layout -->
        <div class="hidden md:grid grid-cols-2 gap-6">
          <!-- Android 下载 -->
          <div class="bg-green-500 rounded-2xl shadow-xl overflow-hidden" hover:cursor-pointer @click="goTo(androidUrl)">
            <div class="p-6 md:p-8">
              <div class="flex items-center mb-4">
                <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                  <i i-ph-android-logo class="text-2xl text-white" />
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white">
                    {{ t('mobile.android.title') }}
                  </h3>
                  <p class="text-white/90">
                    {{ t('mobile.android.subtitle') }}
                  </p>
                </div>
              </div>

              <p class="text-white/80 mb-6">
                {{ t('mobile.android.description') }}
              </p>

              <a
                :href="androidUrl"
                target="_blank"
                class="inline-flex items-center justify-center w-full bg-white text-green-600 hover:bg-green-50 font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
              >
                <i i-ph-download-simple class="mr-2" />
                {{ t('mobile.android.button') }}
              </a>

              <div class="mt-4 text-white/90 text-sm flex items-center">
                <i i-ph-info class="mr-2" />
                {{ t('mobile.android.version') }}
              </div>
            </div>
          </div>

          <!-- iOS 下载 -->
          <div class="bg-orange-500 rounded-2xl shadow-xl overflow-hidden" hover:cursor-pointer @click="goTo(iosUrl)">
            <div class="p-6 md:p-8">
              <div class="flex items-center mb-4">
                <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                  <i i-ph-apple-logo class="text-2xl text-white" />
                </div>
                <div>
                  <h3 class="text-xl font-bold text-white">
                    {{ t('mobile.ios.title') }}
                  </h3>
                  <p class="text-white/90">
                    {{ t('mobile.ios.subtitle') }}
                  </p>
                </div>
              </div>

              <p class="text-white/80 mb-6">
                {{ t('mobile.ios.description') }}
              </p>

              <a
                :href="iosUrl"
                target="_blank"
                class="inline-flex items-center justify-center w-full bg-white text-orange-600 hover:bg-orange-50 font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
              >
                <i i-ph-app-store-logo class="mr-2" />
                {{ t('mobile.ios.button') }}
              </a>

              <div class="mt-4 text-white/90 text-sm flex items-center">
                <i i-ph-info class="mr-2" />
                {{ t('mobile.ios.version') }}
              </div>
            </div>
          </div>
        </div>

        <!-- 使用说明 -->
        <div class="mt-10 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">
            {{ t('mobile.instructions.title') }}
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="text-center">
              <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <i i-ph-qr-code class="text-2xl text-blue-600 dark:text-blue-300" />
              </div>
              <h3 class="font-medium text-gray-800 dark:text-white mb-2">
                {{ t('mobile.instructions.scan-qr.title') }}
              </h3>
              <p class="text-gray-600 dark:text-gray-300 text-sm">
                {{ t('mobile.instructions.scan-qr.description') }}
              </p>
            </div>

            <div class="text-center">
              <div class="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <i i-ph-download class="text-2xl text-purple-600 dark:text-purple-300" />
              </div>
              <h3 class="font-medium text-gray-800 dark:text-white mb-2">
                {{ t('mobile.instructions.click-download.title') }}
              </h3>
              <p class="text-gray-600 dark:text-gray-300 text-sm">
                {{ t('mobile.instructions.click-download.description') }}
              </p>
            </div>

            <div class="text-center">
              <div class="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <i i-ph-rocket-launch class="text-2xl text-green-600 dark:text-green-300" />
              </div>
              <h3 class="font-medium text-gray-800 dark:text-white mb-2">
                {{ t('mobile.instructions.start-using.title') }}
              </h3>
              <p class="text-gray-600 dark:text-gray-300 text-sm">
                {{ t('mobile.instructions.start-using.description') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="mt-12 py-6 border-t border-gray-200 dark:border-gray-700">
      <div class="container mx-auto px-4 text-center">
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          {{ t('mobile.footer.copyright', { year: new Date().getFullYear(), projectName: t('project-name') }) }}
        </p>
        <p class="text-gray-400 dark:text-gray-500 text-xs mt-2">
          {{ t('mobile.footer.contact') }}
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .container {
    padding-left: 1rem;
    padding-right: 1rem;
  }
}
</style>
