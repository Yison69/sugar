const CATEGORIES = ['毕业照', '写真照', '婚礼跟拍', '场地租赁']

Page({
  data: {
    categories: CATEGORIES
  },
  onShow() {
    const tab = this.getTabBar && this.getTabBar()
    if (tab && tab.setData) tab.setData({ selected: 0 })
  },
  openCategory(e) {
    const category = e.currentTarget.dataset.category
    wx.navigateTo({
      url: `/pages/home/index?category=${encodeURIComponent(category)}&mode=package`
    })
  }
})

