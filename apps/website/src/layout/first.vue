<script lang="ts" setup>
import Footer from '~/components/footer/index.vue'
import LoginBanner from '~/components/login-banner/index.vue'

const { t } = useI18n()

const { data: webGuideUrl } = useWeilaFetch<string>('common/guide', {
  body: () => ({
    type: 'corp-web',
  }),
})

const { data: appGuideUrl } = useWeilaFetch<string>('common/guide', {
  body: () => ({
    type: 'corp-app',
  }),
})
</script>

<template>
  <div class="container" relative>
    <a-space fixed right-4 top-4 z-10>
      <a-link href="https://docs-weila-work.pages.dev" target="_blank" rel="noopener noreferrer">
        {{ t('online-docs') }}
      </a-link>
      <span v-mid text-neutral-300>|</span>
      <a-link :href="webGuideUrl">
        {{ t('web-guide') }}
      </a-link>
      <span v-mid text-neutral-300>|</span>
      <a-link :href="appGuideUrl">
        {{ t('app-guide') }}
      </a-link>
    </a-space>
    <div class="logo">
      <img
        alt="logo"
        src="//p3-armor.byteimg.com/tos-cn-i-49unhts6dw/dfdba5317c0c20ce20e64fac803d52bc.svg~tplv-49unhts6dw-image.image"
      >
      <div class="logo-text">
        {{ t('project.name') }}
      </div>
    </div>
    <LoginBanner />
    <div class="content">
      <div class="content-inner">
        <RouterView />
      </div>
      <div class="footer">
        <Footer />
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.container {
  display: flex;
  height: 100vh;

  .content {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    padding-bottom: 40px;
  }

  .footer {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 100%;
  }
}

.logo {
  position: fixed;
  top: 24px;
  left: 22px;
  z-index: 1;
  display: inline-flex;
  align-items: center;

  &-text {
    margin-right: 4px;
    margin-left: 4px;
    color: var(--color-fill-1);
    font-size: 20px;
  }
}
</style>
