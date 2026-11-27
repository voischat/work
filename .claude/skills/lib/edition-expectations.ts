export type EditionKey = 'free' | 'standard' | 'professional' | 'flagship'

export interface EditionExpectation {
  level: number
  name: string
  sidebarDisabled: string[]
  sidebarEnabled: string[]
  editTrack: 'present' | 'absent'
  fast: 'enabled' | 'disabled' | 'absent'
  fastTitle: string
  locDisabled: boolean
  locTitle: string
  routeGuards: [string, 'blocked' | 'allowed'][]
}

export const EDITIONS: Record<EditionKey, EditionExpectation> = {
  free: {
    level: 0,
    name: '免费版',
    sidebarDisabled: ['实时位置', '轨迹', '应用管理'],
    sidebarEnabled: ['消息'],
    editTrack: 'absent',
    fast: 'absent',
    fastTitle: '',
    locDisabled: true,
    locTitle: '专业版功能',
    routeGuards: [
      ['#/workbench/realtime-location', 'blocked'],
      ['#/workbench/user-track', 'blocked'],
      ['#/workbench/message', 'allowed'],
      ['#/workbench/application', 'blocked'],
    ],
  },
  standard: {
    level: 16,
    name: '标准版',
    sidebarDisabled: ['实时位置', '轨迹', '应用管理'],
    sidebarEnabled: ['消息'],
    editTrack: 'absent',
    fast: 'absent',
    fastTitle: '',
    locDisabled: true,
    locTitle: '专业版功能',
    routeGuards: [
      ['#/workbench/realtime-location', 'blocked'],
      ['#/workbench/user-track', 'blocked'],
      ['#/workbench/message', 'allowed'],
      ['#/workbench/application', 'blocked'],
    ],
  },
  professional: {
    level: 32,
    name: '专业版',
    sidebarDisabled: ['应用管理'],
    sidebarEnabled: ['消息', '实时位置', '轨迹'],
    editTrack: 'present',
    fast: 'disabled',
    fastTitle: '旗舰版功能',
    locDisabled: false,
    locTitle: '',
    routeGuards: [
      ['#/workbench/realtime-location', 'allowed'],
      ['#/workbench/user-track', 'allowed'],
      ['#/workbench/message', 'allowed'],
      ['#/workbench/application', 'blocked'],
    ],
  },
  flagship: {
    level: 48,
    name: '旗舰版',
    sidebarDisabled: [],
    sidebarEnabled: ['消息', '实时位置', '轨迹', '应用管理'],
    editTrack: 'present',
    fast: 'enabled',
    fastTitle: '该频率设备耗电大，请慎重',
    locDisabled: false,
    locTitle: '',
    routeGuards: [
      ['#/workbench/realtime-location', 'allowed'],
      ['#/workbench/user-track', 'allowed'],
      ['#/workbench/message', 'allowed'],
      ['#/workbench/application', 'allowed'],
    ],
  },
}
