import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: '微喇企业管理台用户手册',
  description: '微喇企业管理台用户手册',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      { text: 'Website', link: 'https://www.voiswork.cn/#/' },
    ],

    sidebar: [
      {
        text: '用户手册',
        items: [
          { text: '账户管理', link: '/account-management' },
          { text: '企业信息', link: '/enterprise-info' },
          {
            text: '通讯录',
            link: '/contacts/',
            items: [
              { text: '成员管理', link: '/contacts/member' },
              { text: '部门管理', link: '/contacts/dept' },
              { text: '群组管理', link: '/contacts/group' },
            ],
          },
          {
            text: '工作台',
            link: '/workspace/',
            items: [
              { text: '聊天频道', link: '/workspace/chat' },
              { text: '实时位置', link: '/workspace/realtime-location' },
              { text: '成员轨迹', link: '/workspace/track' },
            ],
          },
          {
            text: '通用操作',
            link: '/common/',
            items: [
              { text: '搜索与过滤', link: '/common/search-filter' },
              { text: '权限分级', link: '/common/permissions' },
            ],
          },
        ],
      },
      {
        text: '开发',
        items: [{ text: '本地开发环境', link: '/development' }],
      },
    ],

    socialLinks: [],
  },
})
