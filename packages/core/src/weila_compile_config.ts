interface DevProxyEntry {
  target: string
  secure: boolean
  changeOrigin: boolean
  pathRewrite: Record<string, string>
}

function getDevelopeProxy() {
  const proxy = {
    '/v1': {
      target:
        process.env.NODE_ENV === 'production'
          ? 'http://webapi.weila.hk/'
          : 'http://webapi.weila.hk:8080/',
      secure: false,
      changeOrigin: true,
      pathRewrite: {
        '^/v1': '/v1',
      },
    },

    'https://weilacache.oss-cn-shenzhen.aliyuncs.com': {
      target: 'https://weilacache.oss-cn-shenzhen.aliyuncs.com',
      secure: false,
      changeOrigin: true,
      pathRewrite: {
        '^https://weilacache.oss-cn-shenzhen.aliyuncs.com': '',
      },
    },

    'http://weilaavatar.oss-cn-shenzhen.aliyuncs.com': {
      target: 'https://weilaavatar.oss-cn-shenzhen.aliyuncs.com',
      secure: false,
      changeOrigin: true,
      pathRewrite: {
        '^https://weilaavatar.oss-cn-shenzhen.aliyuncs.com': '',
      },
    },

    '/avatar': {
      target: 'https://weilaavatar.oss-cn-shenzhen.aliyuncs.com',
      secure: false,
      changeOrigin: true,
      pathRewrite: {
        '^/avatar': '/avatar',
      },
    },

    '/ptt': {
      target: 'https://weilaspeech.oss-cn-shenzhen.aliyuncs.com',
      secure: false,
      changeOrigin: true,
      pathRewrite: {
        '^/ptt': '/ptt',
      },
    },
  } satisfies Record<string, DevProxyEntry>

  return proxy
}

module.exports = {
  getDevelopeProxy: getDevelopeProxy,
}
