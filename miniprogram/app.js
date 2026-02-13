App({
  globalData: {
    envId: 'cloud1-7guv7m7n94f2b2e0',
    apiBase: '',
    userId: '',
    openid: '',
    nickname: ''
  },
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '提示',
        content: '当前基础库不支持云开发，请升级微信版本',
        showCancel: false
      })
      return
    }

    try {
      const cached = String(wx.getStorageSync('userId') || '').trim()
      if (cached) this.globalData.userId = cached
    } catch (_) {}

    wx.cloud.init({
      env: this.globalData.envId || undefined,
      traceUser: true
    })

    wx.cloud.callFunction({
      name: 'mpApi',
      data: { action: 'login' }
    })
      .then((res) => {
        const { openid } = res.result || {}
        this.globalData.openid = openid || ''
        if (openid) {
          this.globalData.userId = openid
          try {
            wx.setStorageSync('userId', openid)
          } catch (_) {}
        }
      })
      .catch(() => {})
  }
})
