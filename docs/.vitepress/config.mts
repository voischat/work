import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "微喇企业管理台用户手册",
  description: "微喇企业管理台用户手册",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: '账户管理', link: '/account-management' },
      { text: '企业信息', link: '/enterprise-info' },
      { text: '通讯录', link: '/contacts' },
      { text: '工作台', link: '/workspace' },
      { text: '其他', link: '/others' }
    ],

    sidebar: [
      {
        text: '用户手册',
        items: [
          { text: '账户管理', link: '/account-management' },
          { text: '企业信息', link: '/enterprise-info' },
          { text: '通讯录', link: '/contacts' },
          { text: '工作台', link: '/workspace' },
          { text: '其他', link: '/others' }
        ]
      }
    ],

    socialLinks: []
  }
})
