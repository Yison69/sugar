const { callMpApi } = require('../../utils/cloud')
const { resolveTempUrls, isCloudFileId } = require('../../utils/media')

Page({
  data: {
    form: {
      contactName: '',
      contactPhone: '',
      contactWechat: '',
      shootingType: '',
      scheduledAt: '',
      remark: ''
    },
    wechatText: '（请在后台配置）',
    wechatQrUrl: ''
  },
  onLoad() {
    callMpApi('getContactConfig', {})
      .then((res) => {
        const { wechatText, wechatQrUrl } = res.result || {}
        const raw = wechatQrUrl || ''
        return Promise.resolve().then(async () => {
          const resolved = isCloudFileId(raw) ? (await resolveTempUrls([raw]))[0] : raw
          this.setData({ wechatText: wechatText || '（请在后台配置）', wechatQrUrl: resolved || '' })
        })
      })
      .catch(() => {})
  },
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ form: { ...this.data.form, [field]: e.detail.value } })
  },
  submitBooking() {
    const f = this.data.form
    if (!f.contactName || !f.contactPhone || !f.shootingType || !f.scheduledAt) {
      wx.showToast({ title: '请完善预约信息', icon: 'none' })
      return
    }
    const payload = {
      itemType: 'custom',
      itemId: '',
      itemTitleSnapshot: f.shootingType || '预约',
      selectedOptionsSnapshot: null,
      priceSnapshot: null,
      contactName: f.contactName,
      contactPhone: f.contactPhone,
      contactWechat: f.contactWechat,
      shootingType: f.shootingType,
      scheduledAt: f.scheduledAt,
      remark: f.remark
    }
    wx.showLoading({ title: '提交中…' })
    callMpApi('createBooking', { payload })
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '预约已提交', icon: 'success' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/tabs/bookings/index' })
        }, 600)
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' })
      })
  }
})
