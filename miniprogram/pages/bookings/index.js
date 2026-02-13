const { callMpApi } = require('../../utils/cloud')

Page({
  data: {
    loading: false,
    items: []
  },
  onShow() {
    this.load()
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },
  load() {
    this.setData({ loading: true })
    return callMpApi('getMyBookings', {})
      .then((res) => {
        const { items } = res.result || {}
        const mapped = (items || []).map((b) => ({
          ...b,
          createdAtText: b.createdAt ? new Date(b.createdAt).toLocaleString() : ''
        }))
        this.setData({ items: mapped })
      })
      .catch(() => {
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  }
})

