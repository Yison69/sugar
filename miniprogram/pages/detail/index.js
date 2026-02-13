const { callMpApi } = require('../../utils/cloud')
const { resolveTempUrls, isCloudFileId } = require('../../utils/media')

Page({
  data: {
    loading: false,
    item: null,
    type: 'work',
    id: '',
    selected: {},
    price: { base: 0, delta: 0, total: 0, lines: [] },
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
  onLoad(query) {
    this.setData({ id: query.id || '', type: query.type || 'work' })
    this.load()
    callMpApi('getContactConfig', {})
      .then((res) => {
        const { wechatText, wechatQrUrl } = res.result || {}
        const raw = wechatQrUrl || ''
        return Promise.resolve()
          .then(async () => {
            const resolved = isCloudFileId(raw) ? (await resolveTempUrls([raw]))[0] : raw
            this.setData({ wechatText: wechatText || '（请在后台配置）', wechatQrUrl: resolved || '' })
          })
      })
      .catch(() => {})
  },
  load() {
    this.setData({ loading: true })
    return callMpApi('getItemDetail', { id: this.data.id, type: this.data.type })
      .then((res) => {
        const { item } = res.result || {}
        const normalized = item ? this.normalizeItem(item) : null
        return Promise.resolve()
          .then(async () => {
            if (!normalized) {
              this.setData({ item: null, selected: {} }, () => this.recalc())
              return
            }
            const urls = []
            if (normalized.coverUrl) urls.push(normalized.coverUrl)
            for (const m of normalized.mediaList || []) urls.push(m.url)
            const cloudUrls = urls.filter(isCloudFileId)
            const resolved = await resolveTempUrls(cloudUrls)
            const map = new Map()
            for (let i = 0; i < cloudUrls.length; i++) map.set(cloudUrls[i], resolved[i])
            const patched = {
              ...normalized,
              coverUrl: isCloudFileId(normalized.coverUrl) ? map.get(normalized.coverUrl) || normalized.coverUrl : normalized.coverUrl,
              mediaList: (normalized.mediaList || []).map((x) => ({
                ...x,
                url: isCloudFileId(x.url) ? map.get(x.url) || x.url : x.url
              }))
            }
            if (patched.type === 'package') {
              const init = this.initDefaultSelection(patched)
              this.setData({ item: init.item, selected: init.selected }, () => this.recalc())
            } else {
              this.setData({ item: patched, selected: {} }, () => this.recalc())
            }
          })
      })
      .catch(() => {
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  },
  normalizeItem(raw) {
    const mediaUrls = raw.mediaUrls || raw.imageUrls || []
    const mediaList = (mediaUrls || []).map((url) => {
      const u = String(url || '')
      const lower = u.toLowerCase()
      const kind = lower.endsWith('.mp4') ? 'video' : 'image'
      return { url: u, kind }
    })

    const optionGroups = (raw.optionGroups || []).map((g) => {
      const items = (g.items || []).map((it) => {
        const d = Number(it.deltaPrice || 0)
        const deltaText = !d ? '¥ 0' : (d > 0 ? '+ ' : '- ') + '¥ ' + Math.abs(d)
        return { ...it, deltaText, checked: false }
      })
      return { ...g, items }
    })

    return { ...raw, mediaList, optionGroups }
  },
  initDefaultSelection(item) {
    const selected = {}
    const optionGroups = (item.optionGroups || []).map((g) => {
      if (g.required && g.selectMode === 'single' && (g.items || []).length) {
        const first = g.items[0]
        selected[g.id] = first.id
        const items = (g.items || []).map((it) => ({ ...it, checked: it.id === first.id }))
        return { ...g, items }
      }
      return g
    })
    return { item: { ...item, optionGroups }, selected }
  },
  toggleLike() {
    if (!this.data.item) return
    callMpApi('toggleLike', { targetId: this.data.item.id, targetType: this.data.item.type })
      .then((res) => {
        const { liked, likeCount } = res.result || {}
        this.setData({ item: { ...this.data.item, isLiked: liked, likeCount } })
      })
      .catch(() => wx.showToast({ title: '操作失败', icon: 'none' }))
  },
  onRadioChange(e) {
    const groupId = e.currentTarget.dataset.groupid
    const value = e.detail.value
    const item = this.data.item
    if (!item || item.type !== 'package') return

    const optionGroups = (item.optionGroups || []).map((g) => {
      if (g.id !== groupId) return g
      const items = (g.items || []).map((it) => ({ ...it, checked: it.id === value }))
      return { ...g, items }
    })
    const selected = { ...this.data.selected, [groupId]: value }
    this.setData({ item: { ...item, optionGroups }, selected })
    this.recalc()
  },
  onCheckboxChange(e) {
    const groupId = e.currentTarget.dataset.groupid
    const values = e.detail.value || []
    const item = this.data.item
    if (!item || item.type !== 'package') return

    const optionGroups = (item.optionGroups || []).map((g) => {
      if (g.id !== groupId) return g
      const items = (g.items || []).map((it) => ({ ...it, checked: values.includes(it.id) }))
      return { ...g, items }
    })
    const selected = { ...this.data.selected, [groupId]: values }
    this.setData({ item: { ...item, optionGroups }, selected })
    this.recalc()
  },
  recalc() {
    const item = this.data.item
    if (!item || item.type !== 'package') {
      this.setData({ price: { base: 0, delta: 0, total: 0, lines: [] } })
      return
    }
    const base = Number(item.basePrice || 0)
    const lines = []
    let delta = 0
    for (const g of item.optionGroups || []) {
      const sel = this.data.selected[g.id]
      const pickIds = Array.isArray(sel) ? sel : sel ? [sel] : []
      for (const pid of pickIds) {
        const it = (g.items || []).find((x) => x.id === pid)
        if (!it) continue
        const d = Number(it.deltaPrice || 0)
        delta += d
        lines.push({ name: `${g.name}：${it.name}`, delta: d })
      }
    }
    this.setData({ price: { base, delta, total: base + delta, lines } })
  },
  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ form: { ...this.data.form, [field]: e.detail.value } })
  },
  submitBooking() {
    if (!this.data.item) return
    const f = this.data.form
    if (!f.contactName || !f.contactPhone || !f.contactWechat || !f.shootingType || !f.scheduledAt) {
      wx.showToast({ title: '请完善预约信息', icon: 'none' })
      return
    }
    const payload = {
      itemType: this.data.item.type,
      itemId: this.data.item.id,
      itemTitleSnapshot: this.data.item.title,
      selectedOptionsSnapshot: this.data.item.type === 'package' ? this.data.selected : null,
      priceSnapshot: this.data.item.type === 'package' ? this.data.price : null,
      contactName: f.contactName,
      contactPhone: f.contactPhone,
      contactWechat: f.contactWechat,
      shootingType: f.shootingType,
      scheduledAt: f.scheduledAt,
      remark: f.remark
    }
    wx.showLoading({ title: '提交中…' })
    callMpApi('createBooking', payload)
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
