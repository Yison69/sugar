const { callMpApi } = require('../../../utils/cloud')

Page({
  data: {
    loading: false,
    items: []
  },
  goNew() {
    wx.navigateTo({ url: '/pages/booking-new/index' })
  },
  onShow() {
    const tab = this.getTabBar && this.getTabBar()
    if (tab && tab.setData) tab.setData({ selected: 2 })
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
      .catch((err) => {
        const msg = err && err.message ? err.message : '加载失败'
        wx.showToast({ title: msg, icon: 'none' })
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  }
})
