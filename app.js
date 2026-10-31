const store = require('./utils/store')

App({
  onLaunch() {
    store.init()
  },

  onError(err) {
    console.error('[拾味小馆] 未捕获异常：', err)
  }
})
