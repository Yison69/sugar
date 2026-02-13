App({
  globalData: {
    envId: 'cloud1-7guv7m7n94f2b2e0',
    apiBase: 'https://sugar-dusky.vercel.app',
    userId: '',
    openid: '',
    nickname: ''
  },
  onLaunch() {
    if (this.globalData.apiBase) {
      try {
        const cached = String(wx.getStorageSync('userId') || '').trim()
        const userId = cached || `u_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        if (!cached) wx.setStorageSync('userId', userId)
        this.globalData.userId = userId
        this.globalData.openid = userId
      } catch (_) {}
      return
    }

    if (!wx.cloud) {
      wx.showModal({
        title: '提示',
        content: '当前基础库不支持云开发，请升级微信版本',
        showCancel: false
      })
      return
    }

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
      })
      .catch(() => {})
  }
})
