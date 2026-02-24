const { callMpApi } = require('../../../utils/cloud')
const { ensureMpLogin, getMpLoginUser, clearMpLoggedIn } = require('../../../utils/auth')

const isCloudFileId = (v) => typeof v === 'string' && v.startsWith('cloud://')

async function toTempUrl(v) {
  if (!isCloudFileId(v)) return v
  const res = await wx.cloud
    .getTempFileURL({
      fileList: [{ fileID: v, maxAge: 3600 }]
    })
    .catch(() => null)
  const first = res && res.fileList && res.fileList[0]
  return (first && first.tempFileURL) || v
}

Page({
  data: {
    loginName: '',
    wechatText: '',
    wechatQrUrl: ''
  },
  onShow() {
    if (!ensureMpLogin(this)) return
    const tab = this.getTabBar && this.getTabBar()
    if (tab && tab.setData) tab.setData({ selected: 2 })
    this.setData({ loginName: getMpLoginUser() || '已登录用户' })
    this.loadContactConfig()
  },
  loadContactConfig() {
    return callMpApi('getContactConfig', {})
      .then(async (res) => {
        const cfg = (res && res.result) || {}
        const wechatText = cfg.wechatText || ''
        const raw = cfg.wechatQrUrl || ''
        const wechatQrUrl = await toTempUrl(raw)
        this.setData({ wechatText, wechatQrUrl })
      })
      .catch(() => {})
  },
  onLogin() {
    wx.showActionSheet({
      itemList: ['退出登录'],
      success: (r) => {
        if (r.tapIndex !== 0) return
        clearMpLoggedIn()
        wx.reLaunch({ url: '/pages/login/index' })
      }
    })
  },
  onCommunity() {
    wx.showToast({ title: '敬请期待', icon: 'none' })
  },
  onGroup() {
    wx.showToast({ title: '敬请期待', icon: 'none' })
  },
  onCrop() {
    wx.showToast({ title: '敬请期待', icon: 'none' })
  },
  onMore() {
    wx.showToast({ title: '敬请期待', icon: 'none' })
  },
  onMemberCode() {
    wx.showToast({ title: '敬请期待', icon: 'none' })
  },
  onContact() {
    const wechatText = this.data.wechatText || ''
    const wechatQrUrl = this.data.wechatQrUrl || ''
    if (!wechatText && !wechatQrUrl) {
      wx.showToast({
        title: '云端未配置联系方式',
        icon: 'none'
      })
      return
    }

    const itemList = []
    if (wechatText) itemList.push('复制微信号')
    if (wechatQrUrl) itemList.push('查看二维码')
    itemList.push('取消')

    wx.showActionSheet({
      itemList,
      success: (r) => {
        const pick = itemList[r.tapIndex]
        if (pick === '复制微信号') {
          wx.setClipboardData({ data: wechatText })
        }
        if (pick === '查看二维码') {
          wx.previewImage({ urls: [wechatQrUrl] })
        }
      }
    })
  }
})
