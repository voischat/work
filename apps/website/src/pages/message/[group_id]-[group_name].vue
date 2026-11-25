<script setup lang="ts">
import { useInfiniteQuery } from '@tanstack/vue-query'
import { computed, shallowRef } from 'vue'

import MessageFileContent from '~/components/MessageFileContent.vue'
import MessageLocationContent from '~/components/MessageLocationContent.vue'
import MessagePictureContent from '~/components/MessagePictureContent.vue'
import MessageRevokeContent from '~/components/MessageRevokeContent.vue'
import MessageTextContent from '~/components/MessageTextContent.vue'
import MessageUnsupportedContent from '~/components/MessageUnsupportedContent.vue'
import MessageVideoContent from '~/components/MessageVideoContent.vue'
import MessageVoiceContent from '~/components/MessageVoiceContent.vue'

enum MessageType {
  Text,
  Picture,
  Video,
  Voice,
  File,
  _,
  Location,
  Revoke,
  Unsupported = 255,
}

const messageTypeComponentMap = {
  [MessageType.Text]: MessageTextContent,
  [MessageType.Picture]: MessagePictureContent,
  [MessageType.Video]: MessageVideoContent,
  [MessageType.Voice]: MessageVoiceContent,
  [MessageType.File]: MessageFileContent,
  [MessageType.Location]: MessageLocationContent,
  [MessageType.Revoke]: MessageRevokeContent,
  [MessageType.Unsupported]: MessageUnsupportedContent,
}

const route = useRoute('/message/[group_id]-[group_name]')

const messageContainerEl = useTemplateRef('messageContainerEl')
const { arrivedState } = useScroll(messageContainerEl)

function getToday() {
  return new Date().toISOString().split('T')[0]
}

const date = shallowRef(getToday())

const { data, fetchNextPage } = useInfiniteQuery({
  enabled: computed(() => Boolean(date.value)),
  initialPageParam: 0,
  queryKey: ['/corp/web/message-get-group-history-message', date, route.params.group_id],
  queryFn: async ({ pageParam = 0 }) => {
    const res = await weilaFetch<any>('/corp/web/message-get-group-history-message', {
      body: {
        group_id: Number(route.params.group_id),
        msg_id: pageParam,
        msg_count: 20,
        date: date.value,
      },
    })

    return { messages: res.messages, users: res.users }
  },
  getNextPageParam: (lastPage) => {
    if (lastPage.messages.length < 20)
      return undefined

    return Math.min(...lastPage.messages.map((i: any) => i.msg_id))
  },
})

const users = computed<Record<string, any['data']['users'][number]>>(() =>
  Object.fromEntries((data.value?.pages ?? []).flatMap(page => page.users.map((user: any) => [user.user_id, user]))),
)

watch(arrivedState, ({ top }) => {
  if (top)
    fetchNextPage()
})

$inspect(data)
</script>

<template>
  <div h-full grid="~ rows-[min-content_1fr]">
    <header flex items-center gap4 p-4 dark:bg-dark-300>
      <h1 class="text-2xl font-bold">
        {{ route.params.group_name }}
      </h1>
      <a-date-picker v-model="date" />
    </header>
    <div relative of-scroll>
      <a-empty v-if="!data?.pages.length || !Object.keys(users).length" absolute position-center />
      <ul
        v-else
        ref="messageContainerEl" relative flex grow-1 flex-col flex-col-reverse of-scroll overflow-y-auto
        scroll-smooth bg-neutral-1 p-4 space-y-4
        dark:bg-dark-800
      >
        <template v-for="page in data?.pages">
          <li v-for="message in page.messages" id="message-list" :key="message.msg_id" flex gap1 p-3>
            <section>
              <a-avatar :image-url="users[message.user_id]?.avatar">
                <IconUser />
              </a-avatar>
            </section>
            <section>
              <div color-neutral>
                <div space-x-2>
                  <span>
                    {{ users[message.user_id]?.name }}({{ users[message.user_id]?.user_num }})
                  </span>
                  <span>
                    {{ new Date(message.created * 1000).toLocaleString() }}
                  </span>
                </div>
              </div>

              <div class="content">
                <!-- @vue-expect-error type error -->
                <component :is="messageTypeComponentMap[message.type] || MessageUnsupportedContent" :content="message.content" />
              </div>
            </section>
          </li>
        </template>

        <a-back-top target-container="#message-list" absolute :visible-height="0" />
      </ul>
    </div>
  </div>
</template>

<style scoped>
.content > * {
  --uno: bg-white dark-bg-neutral-8 op85 hover-op100;
}
</style>
