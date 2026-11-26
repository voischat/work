// Shared per-edition UI expectations for the weila-work verify skills. Each key
// mirrors the membership `name` returned by corp/org/get-vip-membership, and
// `level` is the numeric `level` on the same payload.

export const EDITIONS = {
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
