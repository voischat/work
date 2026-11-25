<script lang="ts" setup>
import { useFullscreen } from '@vueuse/core'
import { computed, inject, shallowRef } from 'vue'
import { useToggleLocales } from '~/composables/useToggleLocales'
import { isDev } from '~/shared'
import { useAuthStore } from '~/stores/auth'
import { version } from '../../../package.json'
import BindingPhone from '../BindingPhone.vue'
import DeleteAccount from '../DeleteAccount.vue'

const { t } = useI18n()

const appStore = useAppStore()
const { logout } = useAuthStore()
const { isFullscreen, toggle: toggleFullScreen } = useFullscreen()
const topMenu = computed(() => appStore.topMenu && appStore.menu)

const toggleDrawerMenu = inject('toggleDrawerMenu') as () => void

const { toggle: toggleLocales } = useToggleLocales()

const selfInfoStore = useSelfInfoStore()

const resetPasswordModalVisible = shallowRef(false)
const bindingPhoneModalVisible = shallowRef(false)
const deleteAccountModalVisible = shallowRef(false)

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

function tryLogout() {
  logout()
}

const buildTime = new Date(__BUILD_TIME__).toLocaleString()
</script>

<template>
  <div flex="~ justify-between" border-b p4 pr10>
    <a-space>
      <img alt="logo" rounded-full size-10 src="/src/assets/logo.png">
      <a-typography-title :style="{ margin: 0, fontSize: '18px' }" :heading="5" max-lg:hidden>
        {{ t('project.name') }}
      </a-typography-title>
      <icon-menu-fold
        v-if="!topMenu && appStore.device === 'mobile'" style="font-size: 22px; cursor: pointer"
        @click="toggleDrawerMenu"
      />
      <a-tag color="green" shape="round">
        {{ $t('v-version') }} {{ version }}
      </a-tag>
      <a-tag shape="round" color="gray" space-x-2>
        <icon-code-sandbox /> <span>{{ $t('build-time') }} {{ buildTime }}</span>
      </a-tag>
    </a-space>
    <a-space size="large">
      <li v-if="isDev">
        <a-tooltip :content="t('settings.language')">
          <a-button class="nav-btn" type="outline" shape="circle" @click="toggleLocales">
            <template #icon>
              <icon-language />
            </template>
          </a-button>
        </a-tooltip>
      </li>
      <a-trigger trigger="click" position="br" :popup-translate="[0, 8]">
        <a-button class="nav-btn" type="outline" shape="circle">
          <template #icon>
            <icon-book />
          </template>
        </a-button>
        <template #content>
          <div bg-white border rounded-lg p2 shadow-lg>
            <a-link
              href="https://docs-weila-work.pages.dev" target="_blank" rel="noopener noreferrer"
              block p2
            >
              {{ t('online-docs') }}
            </a-link>
            <a-link :href="webGuideUrl" target="_blank" rel="noopener noreferrer" block p2>
              {{ t('web-guide') }}
            </a-link>
            <a-link :href="appGuideUrl" target="_blank" rel="noopener noreferrer" block p2>
              {{ t('app-guide') }}
            </a-link>
          </div>
        </template>
      </a-trigger>
      <a-tooltip
        :content="isFullscreen
          ? t('settings.navbar.screen.toExit')
          : t('settings.navbar.screen.toFull')
        "
      >
        <a-button class="nav-btn" type="outline" shape="circle" @click="toggleFullScreen">
          <template #icon>
            <icon-fullscreen-exit v-if="isFullscreen" />
            <icon-fullscreen v-else />
          </template>
        </a-button>
      </a-tooltip>

      <a-dropdown trigger="click" :popup-max-height="false">
        <a-avatar hover:op75 cursor-pointer :image-url="selfInfoStore.selfInfo?.avatar">
          <IconUser />
        </a-avatar>

        <template #content>
          <div class="p4 flex-col gap-[15px] text-center items-center justify-center">
            <div v-if="selfInfoStore.selfInfo" class="flex flex-col gap-2">
              <div class="text-lg text-primary font-semibold">
                {{ selfInfoStore.selfInfo.name }}
              </div>
              <div class="text-secondary text-sm">
                {{ t('weila-number') }}: {{ selfInfoStore.selfInfo.user_num }}
              </div>
              <div class="flex items-center gap-2">
                <a-tag color="blue" mxa>
                  +{{ selfInfoStore.selfInfo.country_code }} {{ selfInfoStore.selfInfo.bind_phone }}
                </a-tag>
              </div>
            </div>
            <div flex="~ col" mt6 gap2>
              <a-button @click="bindingPhoneModalVisible = true">
                {{ t('binding-phone') }}
              </a-button>
              <a-button @click="resetPasswordModalVisible = true">
                {{ t('button.reset-password') }}
              </a-button>
              <a-button @click="tryLogout">
                {{ t('logout') }}
              </a-button>
              <a-button status="danger" @click="deleteAccountModalVisible = true">
                {{ t('button.delete-account') }}
              </a-button>
            </div>
          </div>
        </template>
      </a-dropdown>
    </a-space>
  </div>

  <ResetSelfPasswordModal v-model:open="resetPasswordModalVisible" />
  <BindingPhone v-model:open="bindingPhoneModalVisible" />
  <DeleteAccount v-model:open="deleteAccountModalVisible" />
</template>
