import type { RealtimeLocationModel } from '~/api/realtime-location'
import { shallowRef } from 'vue'

// Mock用户数据
const mockUsers = [
  {
    user_id: 1253951,
    user_num: '70015888',
    job_num: '',
    product: '',
    imei: '',
    sex: 0,
    name: '企业主',
    avatar: 'http://weilacorp.oss-cn-shenzhen.aliyuncs.com/default/user.png',
    is_dept_admin: 0,
    dept_id: 3,
    phone: '19225302194',
    country_code: '86',
    state: 0,
    type: 255,
    tts: 1,
    loc_share: 0,
    track: 0,
    grp_cnt: 2,
    grp_lmt: 100,
    online_status: 0,
    created: 1757991128,
  },
  {
    user_id: 1253926,
    user_num: '70010188',
    job_num: '',
    product: '',
    imei: '',
    sex: 0,
    name: '成员 9',
    avatar: 'http://weilacorp.oss-cn-shenzhen.aliyuncs.com/default/user.png',
    is_dept_admin: 0,
    dept_id: 3,
    phone: '18800000009',
    country_code: '86',
    state: 0,
    type: 0,
    tts: 1,
    loc_share: 1,
    track: 0,
    grp_cnt: 1,
    grp_lmt: 100,
    online_status: 0,
    created: 1761015029,
  },
  {
    user_id: 1253927,
    user_num: '70013347',
    job_num: '',
    product: '',
    imei: '',
    sex: 0,
    name: '成员10',
    avatar: '',
    is_dept_admin: 0,
    dept_id: 3,
    phone: '18800000010',
    country_code: '86',
    state: 0,
    type: 0,
    tts: 1,
    loc_share: 1,
    track: 3,
    grp_cnt: 2,
    grp_lmt: 100,
    online_status: 0,
    created: 1759997300,
  },
  {
    user_id: 1253965,
    user_num: '70015711',
    job_num: '',
    product: '',
    imei: '',
    sex: 0,
    name: '管理1',
    avatar: 'http://cdn.voiswork.cn/corp/100109/u/1253965/1fee_avt.png?v=1760691797',
    is_dept_admin: 1,
    dept_id: 3,
    phone: '',
    country_code: '86',
    state: 0,
    type: 2,
    tts: 1,
    loc_share: 1,
    track: 0,
    grp_cnt: 1,
    grp_lmt: 100,
    online_status: 0,
    created: 1760064225,
  },
]

// 生成mock位置数据（基于初始位置，每次调用都会偏移）
let callCount = 0
function generateMockLocations(): RealtimeLocationModel[] {
  const baseTime = Date.now()
  const locations: RealtimeLocationModel[] = []

  // 起始位置（中国东部）
  const baseLat = 31.2304 // 上海纬度
  const baseLng = 121.4737 // 上海经度

  mockUsers.forEach((user, index) => {
    // 每个用户的位置从中国东部逐步向西北移动
    // 每次调用都会增加偏移量，模拟移动
    const latOffset = (index * 0.5) + (callCount * 0.01) // 向北偏移，每次调用增加
    const lngOffset = -(index * 0.8) - (callCount * 0.015) // 向西偏移，每次调用增加

    locations.push({
      uid: user.user_id,
      type: user.type,
      lat: baseLat + latOffset,
      lng: baseLng + lngOffset,
      spd: Math.random() * 80 + 20, // 速度 20-100 km/h
      rad: Math.random() * 360, // 随机方向
      dir: Math.floor(Math.random() * 360), // 随机角度
      ts: baseTime - (index * 60000), // 时间戳递减
    })
  })

  callCount++
  return locations
}

export function useRealtimeLocation(
  selectedType: Ref<'dept' | 'group' | 'individual'>,
  selectedId: Ref<number | undefined>,
) {
  const enabled = computed(() => selectedId.value !== undefined)

  watch(selectedType, () => selectedId.value = undefined)

  const { data: apiLocations, refetch: apiRefetch } = useWeilaFetch<RealtimeLocationModel[]>('corp/loc/get-realtime-location', {
    body: () => {
      const sessionType = selectedType.value === 'dept' ? 20 : selectedType.value === 'individual' ? 17 : 18
      return {
        session_id: selectedId.value,
        session_type: sessionType,
      }
    },
  }, {
    enabled,
    immediate: false,
  })

  // 当API返回空数据时使用mock数据
  const useMockData = computed(() => {
    return !apiLocations.value?.length && import.meta.env.DEV
  })

  const mockLocations = shallowRef<RealtimeLocationModel[]>([])

  const refetch = () => {
    apiRefetch()
    if (useMockData.value) {
      mockLocations.value = generateMockLocations()
    }
  }

  // 合并数据：优先使用API数据，如果为空则使用mock数据
  const locations = computed(() =>
    useMockData.value
      ? mockLocations.value
      : apiLocations.value,
  )

  // 定时刷新位置数据
  const { pause, resume } = useIntervalFn(() => {
    if (enabled.value) {
      refetch()
    }
  }, 5000)

  // 初始化时获取数据
  watch([enabled, selectedId], () => {
    if (enabled.value) {
      refetch()
    }
  }, { immediate: true })

  return {
    locations,
    refetch,
    pause,
    resume,
  }
}
