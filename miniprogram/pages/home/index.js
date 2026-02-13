const { callMpApi } = require('../../utils/cloud')
const { resolveTempUrls, isCloudFileId } = require('../../utils/media')

const CATEGORIES = ['毕业照', '写真照', '婚纱照', '场地租赁']

const pickHeight = (id) => {
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const candidates = [340, 380, 420, 460, 520]
  return candidates[h % candidates.length]
}

const splitColumns = (items) => {
  const left = []
  const right = []
  let hl = 0
  let hr = 0
  for (const it of items) {
    const est = (it && it._h) || 400
    if (hl <= hr) {
      left.push(it)
      hl += est
    } else {
      right.push(it)
      hr += est
    }
  }
  return { left, right }
}

const makeSkeleton = () => {
  const base = Array.from({ length: 10 }).map((_, idx) => ({ id: `sk_${idx}`, _h: [340, 420, 380, 520, 460][idx % 5] }))
  return splitColumns(base)
}

const haptic = () => {
  try {
    wx.vibrateShort({ type: 'light' })
  } catch (_) {
    try {
      wx.vibrateShort()
    } catch (_) {}
  }
}

Page({
  data: {
    categories: CATEGORIES,
    currentCategory: '写真照',
    currentType: 'all',
    typeLocked: false,
    loading: false,
    items: [],
    leftItems: [],
    rightItems: [],
    skLeft: [],
    skRight: []
  },
  onLoad(options) {
    const rawCategory = options && options.category
    let category = rawCategory
    if (typeof category === 'string') {
      try {
        category = decodeURIComponent(category)
      } catch (_) {}
    }
    const mode = options && options.mode
    const typeLocked = mode === 'work' || mode === 'package'
    const currentType = mode === 'work' ? 'work' : mode === 'package' ? 'package' : this.data.currentType
    const currentCategory = category && CATEGORIES.includes(category) ? category : this.data.currentCategory
    const sk = makeSkeleton()
    this.setData({
      skLeft: sk.left,
      skRight: sk.right,
      currentCategory,
      currentType,
      typeLocked
    })
    if (typeLocked) {
      wx.setNavigationBarTitle({ title: currentType === 'package' ? '服务' : '作品' })
    } else {
      wx.setNavigationBarTitle({ title: '摄影服务' })
    }
    this.load()
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },
  load() {
    const seq = (this._loadSeq || 0) + 1
    this._loadSeq = seq
    this.setData({ loading: true })
    return callMpApi('listItems', {
      category: this.data.currentCategory,
      type: this.data.currentType
    })
      .then((res) => {
        if (this._loadSeq !== seq) return
        const { items } = res.result || {}
        const enhanced = (items || []).map((it) => ({ ...it, _h: pickHeight(it.id) }))
        return Promise.resolve()
          .then(async () => {
            const need = enhanced.map((x) => x.coverUrl).filter(isCloudFileId)
            const resolved = await resolveTempUrls(need)
            const map = new Map()
            for (let i = 0; i < need.length; i++) map.set(need[i], resolved[i])
            const patched = enhanced.map((x) => ({ ...x, coverUrl: isCloudFileId(x.coverUrl) ? map.get(x.coverUrl) || x.coverUrl : x.coverUrl }))
            const cols = splitColumns(patched)
            this.setData({ items: patched, leftItems: cols.left, rightItems: cols.right })
          })
      })
      .catch((err) => {
        if (this._loadSeq !== seq) return
        const msg = err && err.message ? err.message : '加载失败'
        wx.showToast({ title: msg, icon: 'none' })
      })
      .finally(() => {
        if (this._loadSeq !== seq) return
        this.setData({ loading: false })
      })
  },
  openDetail(e) {
    const { id, type } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}` })
  },
  toggleLike(e) {
    const { id, type } = e.currentTarget.dataset
    callMpApi('toggleLike', { targetId: id, targetType: type })
      .then((res) => {
        const { liked, likeCount } = res.result || {}
        const patch = (list) => (list || []).map((it) => (it.id === id && it.type === type ? { ...it, isLiked: liked, likeCount } : it))
        this.setData({ items: patch(this.data.items), leftItems: patch(this.data.leftItems), rightItems: patch(this.data.rightItems) })
      })
      .catch(() => {
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
  },
  
})
