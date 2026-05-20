<script setup lang="ts">
import type { UnwrapRef } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useQuery } from '@tanstack/vue-query'
import { ElAmap } from '@vuemap/vue-amap'
import { toBlob } from 'html-to-image'
import { shallowRef } from 'vue'

interface RegeoV2 {
  province: string
  city: string
  citycode: string
  district: string
  adcode: string
  township: string
  Address: string
}

const props = withDefaults(defineProps<{
  options?: {
    center?: [number, number]
    zoom?: number
    radius?: number
  }
}>(), {
  options: () => ({
    zoom: 15,
    radius: 300,
  }),
})

const emit = defineEmits<{
  (e: 'update:value', value: RegeoV2 & {
    lon: number
    lat: number
  }): void
}>()

const UNKOWN_ADDRESS = '[未知的地理位置]'
const weilaApi = useWeilaApi()

const zoom = shallowRef(props.options.zoom || 15)
const { coords, isSupported, error: coordsError } = useGeolocation({
  immediate: true,
  enableHighAccuracy: true,
})

watchEffect(() => {
  if (props.options.center)
    return

  if (!isSupported.value)
    return Message.error('无法获取当前位置')

  if (coordsError.value)
    return Message.error(`获取当前位置失败(${coordsError.value.code})`)
})

function checkCoordsValue(coords: UnwrapRef<ReturnType<typeof useGeolocation>['coords']>) {
  if (coordsError.value)
    return false

  if (coords.longitude === 0
    || coords.latitude === 0
    || coords.longitude === Infinity
    || coords.latitude === Infinity
  ) {
    return false
  }

  return true
}

const defaultCenter: [number, number] = props.options.center
  ?? [114.057868, 22.543099]

const center = defineModel<[number, number]>('center', {
  required: false,
  default: null,
})

// defineModel can not reference a variant as default value
if (!center.value)
  center.value = defaultCenter

const radius = shallowRef(props.options.radius || 300)

const map = shallowRef<AMap.Map | null>(null)
const mapCaptureRef = shallowRef<HTMLElement | null>(null)

const isTouching = shallowRef(false)
const isMoving = shallowRef(false)
const isIdle = computed(() => !isTouching.value && !isMoving.value)

const pickedCenter = computed(() => {
  if (!isIdle.value)
    return null

  return center.value
})

const regeoQueryParams = computed(() => {
  if (!pickedCenter.value)
    return null

  return {
    lon: pickedCenter.value[0],
    lat: pickedCenter.value[1],
    radius: radius.value,
  }
})

const { data: regeo } = useQuery({
  enabled: computed(() => !!regeoQueryParams.value),
  queryKey: computed(() => ['regeo', regeoQueryParams.value]),
  queryFn: async () => {
    if (!regeoQueryParams.value)
      throw new Error('Missing picked center')

    return weilaApi.value.v2.fetch<RegeoV2>('loc/regeo', {
      body: regeoQueryParams.value,
    })
  },
})

const address = computed(() => {
  if (!isIdle.value)
    return ''

  if (!regeo.value)
    return ''

  const { Address } = regeo.value

  let res = `${Address}`

  if (!res)
    res = UNKOWN_ADDRESS

  return res
})

const addr = shallowRef('')
watchEffect(() => {
  if (regeo.value)
    addr.value = `${regeo.value.Address}`
})

// to self location
const { stop } = watch(coords, () => {
  if (props.options.center) {
    return
  }

  if (checkCoordsValue(coords.value)) {
    center.value = [coords.value.longitude, coords.value.latitude]
    stop()
  }
}, { immediate: true })

function handleMapInit(m: AMap.Map) {
  map.value = m

  m.on('click', (e: any) => {
    const { lng, lat } = e.lnglat
    center.value = [lng, lat]
  })

  m.on('touchstart', () => isTouching.value = true)
  m.on('touchmove', () => isTouching.value = true)
  m.on('touchend', () => isTouching.value = false)
  m.on('movestart', () => isMoving.value = true)
  m.on('mapmove', () => isMoving.value = true)
  m.on('moveend', () => isMoving.value = false)
}

function confirm() {
  if (!regeo.value) {
    Message.error('请选择一个位置')
    return
  }

  emit('update:value', {
    ...regeo.value,
    lon: center.value![0],
    lat: center.value![1],
    Address: addr.value,
  })
}

async function captureImage(): Promise<File> {
  if (!mapCaptureRef.value)
    throw new Error('Missing map capture target')

  await nextTick()

  // Capture only the map layer and marker overlay. The parent keeps a canvas fallback
  // because third-party map tiles can fail when html-to-image inlines image assets.
  const blob = await toBlob(mapCaptureRef.value, {
    canvasWidth: 400,
    canvasHeight: 200,
    pixelRatio: 1,
    cacheBust: true,
    skipFonts: true,
    backgroundColor: '#e8f1ef',
  })

  if (!blob)
    throw new Error('Failed to capture map DOM')

  return new File([blob], `location-${Date.now()}.png`, { type: blob.type || 'image/png' })
}

defineExpose({
  captureImage,
})
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="mapCaptureRef" absolute inset-0>
      <ElAmap v-model:center="center" v-model:zoom="zoom" @init="handleMapInit" />

      <div absolute left-4 top-4 rounded-lg bg-white p2 color-black>
        <div flex="items-center ~" space-x-2>
          <i i-ph-map-pin />
          <span>
            {{ [regeo?.province, regeo?.district, regeo?.township].filter(Boolean).join(' · ') }}
          </span>
        </div>
      </div>

      <div absolute position-x-center top="50%" translate-y="-100%" flex="~ col items-center">
        <p flex-1 rounded-full bg-primary:70 p4 text-white backdrop-blur-2xl transition-all flex="items-center ~">
          <span sm:max-w="75vw" w-fit truncate break-keep>
            {{ address }}
          </span>
        </p>
        <div mxa h-15 w-1 rounded-b-full bg-primary:70 backdrop-blur-2xl />
      </div>
    </div>

    <div absolute bottom-10 position-x-center>
      <textarea
        v-model="addr"
        :rows="3"
        dark="bg-neutral-800"
        w-80vw border rounded-lg bg-white:40 p2 outline-none backdrop-blur-3xl lg:w-80
      />

      <div absolute bottom-4 right-2 flex>
        <button v-if="regeo && addr !== regeo.Address" btn="ghost sm" color-primary @click="addr = regeo.Address">
          重置
        </button>
        <button :disabled="!regeo" rounded-lg btn="primary sm" @click="confirm">
          确认
        </button>
      </div>
    </div>
  </div>
</template>
