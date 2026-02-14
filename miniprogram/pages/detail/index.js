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
    heroHeightPx: 420,
    swiperIndex: 0,
    previewUrls: [],
    thumbs: [],
    groupImageUrlsById: {},

    comparePickerOpen: false,
    comparePickerLoading: false,
    compareCandidates: [],
    compareChosenIds: [],

    compareTableOpen: false,
    compareBuildLoading: false,
    comparePackages: [],
    compareRows: [],
    compareColWidthRpx: 240,
    compareMinWidthRpx: 480
  },
  onLoad(query) {
    this.setData({ id: query.id || '', type: query.type || 'work' })
    try {
      const info = wx.getSystemInfoSync()
      const w = Number(info.windowWidth || 0)
      const h = Math.round(w * 1.25)
      if (h > 0) this.setData({ heroHeightPx: h })
    } catch (_) {}
    this.load()
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
            if (normalized.type === 'package') {
              for (const g of normalized.optionGroups || []) {
                for (const it of g.items || []) {
                  for (const u of it.assetUrls || []) urls.push(u)
                }
              }
              for (const g of normalized.includedGroups || []) {
                for (const it of g.items || []) {
                  for (const u of it.assetUrls || []) urls.push(u)
                }
              }
            }
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
              })),
              optionGroups:
                normalized.type === 'package'
                  ? (normalized.optionGroups || []).map((g) => ({
                      ...g,
                      items: (g.items || []).map((it) => ({
                        ...it,
                        assetUrls: (it.assetUrls || []).map((u) => (isCloudFileId(u) ? map.get(u) || u : u)),
                      })),
                    }))
                  : normalized.optionGroups
              ,
              includedGroups:
                normalized.type === 'package'
                  ? (normalized.includedGroups || []).map((g) => ({
                      ...g,
                      items: (g.items || []).map((it) => ({
                        ...it,
                        assetUrls: (it.assetUrls || []).map((u) => (isCloudFileId(u) ? map.get(u) || u : u)),
                      })),
                    }))
                  : normalized.includedGroups
            }

            const previewUrls = (patched.mediaList || []).filter((m) => m && m.kind === 'image' && m.url).map((m) => m.url)
            const thumbs = (patched.mediaList || []).map((m, index) => ({
              index,
              kind: m.kind,
              url: m.url
            }))
            if (patched.type === 'package') {
              const init = this.initDefaultSelection(patched)
              this.setData(
                { item: init.item, selected: init.selected, previewUrls, thumbs, swiperIndex: 0 },
                () => this.recalc(),
              )
            } else {
              this.setData({ item: patched, selected: {}, previewUrls, thumbs, swiperIndex: 0 }, () => this.recalc())
            }
          })
      })
      .catch((err) => {
        const msg = err && err.message ? err.message : '加载失败'
        wx.showToast({ title: msg, icon: 'none' })
      })
      .finally(() => {
        this.setData({ loading: false })
      })
  },
  onSwiperChange(e) {
    const idx = e && e.detail ? Number(e.detail.current || 0) : 0
    this.setData({ swiperIndex: idx })
  },
  onPreviewMedia(e) {
    const idx = e && e.currentTarget && e.currentTarget.dataset ? Number(e.currentTarget.dataset.index || 0) : 0
    const item = this.data.item
    const media = item && item.mediaList ? item.mediaList[idx] : null
    if (!media || media.kind !== 'image') return
    const urls = this.data.previewUrls || []
    if (!urls.length) return
    wx.previewImage({ current: media.url, urls })
  },
  onTapOption(e) {
    const groupId = e && e.currentTarget && e.currentTarget.dataset ? String(e.currentTarget.dataset.groupid || '') : ''
    const optionId = e && e.currentTarget && e.currentTarget.dataset ? String(e.currentTarget.dataset.itemid || '') : ''
    const item = this.data.item
    if (!groupId || !optionId || !item || item.type !== 'package') return

    const group = (item.optionGroups || []).find((g) => String(g.id) === groupId)
    if (!group) return

    let nextSelected
    if (group.selectMode === 'single') {
      nextSelected = { ...this.data.selected, [groupId]: optionId }
    } else {
      const prev = this.data.selected[groupId]
      const arr = Array.isArray(prev) ? prev.map((x) => String(x)) : prev ? [String(prev)] : []
      const has = arr.includes(optionId)
      const nextArr = has ? arr.filter((x) => x !== optionId) : [...arr, optionId]
      nextSelected = { ...this.data.selected, [groupId]: nextArr }
    }

    const optionGroups = (item.optionGroups || []).map((g) => {
      if (String(g.id) !== groupId) return g
      const sel = nextSelected[groupId]
      const pickIds = Array.isArray(sel) ? sel : sel ? [sel] : []
      const items = (g.items || []).map((it) => ({ ...it, checked: pickIds.includes(String(it.id)) }))
      return { ...g, items }
    })

    this.setData({ item: { ...item, optionGroups }, selected: nextSelected }, () => this.recalc())
  },
  onPreviewOptionThumb(e) {
    const url = e && e.currentTarget && e.currentTarget.dataset ? String(e.currentTarget.dataset.url || '') : ''
    const urls = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.urls : null
    const list = Array.isArray(urls) ? urls.map((u) => String(u || '')).filter(Boolean) : []
    if (!url || !list.length) return
    wx.previewImage({ current: url, urls: list })
  },
  formatQtyText(rawQty) {
    const s = String(rawQty || '').trim()
    if (!s) return ''
    if (/^x\s*\d+$/i.test(s)) return `x${s.replace(/^x\s*/i, '')}`
    if (/^\d+$/.test(s)) return `x${s}`
    return s
  },
  normalizeItem(raw) {
    const mediaUrls = raw.mediaUrls || raw.imageUrls || []
    const mediaList = (mediaUrls || []).map((url) => {
      const u = String(url || '')
      const lower = u.toLowerCase()
      const kind = lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') ? 'video' : 'image'
      return { url: u, kind }
    })

    const includedGroups = (raw.includedGroups || []).map((g) => {
      const items = (g.items || []).map((it) => {
        const assetUrls = Array.isArray(it.assetUrls) ? it.assetUrls : []
        const qtyText = this.formatQtyText(it.qty)
        const imageUrls = assetUrls
          .map((u) => String(u || '').trim())
          .filter(Boolean)
          .filter((u) => {
            const lower = u.toLowerCase()
            return !(lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm'))
          })
        const first = assetUrls.length ? String(assetUrls[0] || '') : ''
        const thumbUrl = imageUrls[0] || first
        const thumbLower = thumbUrl.toLowerCase()
        const thumbKind = thumbLower.endsWith('.mp4') || thumbLower.endsWith('.mov') || thumbLower.endsWith('.webm') ? 'video' : 'image'
        return { ...it, qtyText, assetUrls, imageUrls, thumbUrl, thumbKind }
      })
      return { ...g, items }
    })

    const optionGroups = (raw.optionGroups || []).map((g) => {
      const selectMode = g.selectMode || (g.op === 'replace' ? 'single' : 'single')
      const items = (g.items || []).map((it, idx) => {
        const assetUrls = Array.isArray(it.assetUrls) ? it.assetUrls : []
        const qtyText = this.formatQtyText(it.qty)
        const imageUrls = assetUrls
          .map((u) => String(u || '').trim())
          .filter(Boolean)
          .filter((u) => {
            const lower = u.toLowerCase()
            return !(lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm'))
          })

        const first = assetUrls.length ? String(assetUrls[0] || '') : ''
        const thumbUrl = imageUrls[0] || first
        const thumbLower = thumbUrl.toLowerCase()
        const thumbKind = thumbLower.endsWith('.mp4') || thumbLower.endsWith('.mov') || thumbLower.endsWith('.webm') ? 'video' : 'image'

        const d = idx === 0 ? 0 : Number(it.deltaPrice || 0)
        const deltaText = d >= 0 ? `+¥${Math.abs(d)}` : `-¥${Math.abs(d)}`
        return { ...it, qtyText, deltaPrice: d, deltaText, checked: false, assetUrls, imageUrls, thumbUrl, thumbKind }
      })
      return { ...g, selectMode, items }
    })

    return { ...raw, mediaList, includedGroups, optionGroups }
  },
  initDefaultSelection(item) {
    const selected = {}
    const optionGroups = (item.optionGroups || []).map((g) => {
      if ((g.items || []).length) {
        const first = g.items[0]
        selected[g.id] = g.selectMode === 'single' ? String(first.id) : [String(first.id)]
        const items = (g.items || []).map((it) => ({ ...it, checked: String(it.id) === String(first.id) }))
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
  noop() {},
  openComparePicker() {
    const item = this.data.item
    if (!item || item.type !== 'package') return

    this.setData({ comparePickerOpen: true, comparePickerLoading: true, compareChosenIds: [] })
    return callMpApi('listItems', { category: item.category, type: 'package' })
      .then((res) => {
        const { items } = res.result || {}
        const candidates = (items || [])
          .filter((x) => x && x.type === 'package' && String(x.id) !== String(item.id))
          .map((x) => ({ id: x.id, title: x.title, _checked: false }))
        this.setData({ compareCandidates: candidates })
      })
      .catch(() => {
        wx.showToast({ title: '加载套餐失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ comparePickerLoading: false })
      })
  },
  closeComparePicker() {
    this.setData({ comparePickerOpen: false })
  },
  toggleCompareCandidate(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset ? String(e.currentTarget.dataset.id || '') : ''
    if (!id) return
    const chosen = new Set((this.data.compareChosenIds || []).map((x) => String(x)))
    if (chosen.has(id)) chosen.delete(id)
    else chosen.add(id)
    const compareChosenIds = Array.from(chosen)
    const compareCandidates = (this.data.compareCandidates || []).map((c) => ({ ...c, _checked: chosen.has(String(c.id)) }))
    this.setData({ compareChosenIds, compareCandidates })
  },
  confirmCompare() {
    const item = this.data.item
    if (!item || item.type !== 'package') return
    const chosenIds = (this.data.compareChosenIds || []).map((x) => String(x)).filter(Boolean)
    if (!chosenIds.length) {
      wx.showToast({ title: '请选择至少 1 个套餐', icon: 'none' })
      return
    }

    this.setData({ compareBuildLoading: true })
    const ids = [String(item.id), ...chosenIds]
    return Promise.all(
      ids.map((id) =>
        callMpApi('getItemDetail', { id, type: 'package' })
          .then((res) => (res && res.result ? res.result.item : null))
          .catch(() => null),
      ),
    )
      .then((rawItems) => {
        const pkgs = (rawItems || [])
          .filter(Boolean)
          .map((x) => this.normalizeItem(x))
          .map((x) => ({
            id: String(x.id),
            title: String(x.title || ''),
            includedGroups: x.includedGroups || [],
            optionGroups: x.optionGroups || [],
          }))

        if (!pkgs.length) throw new Error('加载失败')

        const rowMap = new Map()
        const includeKeys = []
        const optionKeys = []

        const ensureRow = (key, label, kind) => {
          if (!rowMap.has(key)) {
            rowMap.set(key, { key, label, kind, cellsById: {} })
            if (kind === 'include') includeKeys.push(key)
            else optionKeys.push(key)
          }
          return rowMap.get(key)
        }

        const fmtQty = (rawQty) => this.formatQtyText(rawQty)
        const withQty = (name, rawQty) => {
          const n = String(name || '').trim()
          if (!n) return ''
          const qt = fmtQty(rawQty)
          return qt ? `${n}${qt}` : n
        }

        for (const pkg of pkgs) {
          for (const g of pkg.includedGroups || []) {
            const gn = String(g && g.name ? g.name : '').trim() || '套餐内容'
            for (const it of (g && g.items) || []) {
              const iname = String(it && it.name ? it.name : '').trim()
              if (!iname) continue
              const label = `${gn}/${iname}`
              const row = ensureRow(`inc:${gn}:${iname}`, label, 'include')
              row.cellsById[pkg.id] = withQty(iname, it.qty)
            }
          }

          for (const g of pkg.optionGroups || []) {
            const gn = String(g && g.name ? g.name : '').trim()
            if (!gn) continue
            const first = g && Array.isArray(g.items) && g.items.length ? g.items[0] : null
            if (!first) continue
            const firstName = String(first.name || '').trim()
            const value = firstName ? withQty(firstName, first.qty) : '-'
            const label = `可选：${gn}`
            const row = ensureRow(`opt:${gn}`, label, 'option')
            row.cellsById[pkg.id] = value
          }
        }

        const keys = [...includeKeys, ...optionKeys]
        const compareRows = keys.map((k) => {
          const row = rowMap.get(k)
          return {
            key: row.key,
            label: row.label,
            cells: pkgs.map((p) => (row.cellsById[p.id] ? String(row.cellsById[p.id]) : '-')),
          }
        })

        const colWidth = Number(this.data.compareColWidthRpx || 240)
        const compareMinWidthRpx = colWidth * (1 + pkgs.length)
        this.setData({
          comparePickerOpen: false,
          compareTableOpen: true,
          comparePackages: pkgs.map((p) => ({ id: p.id, title: p.title })),
          compareRows,
          compareMinWidthRpx,
        })
      })
      .catch((e) => {
        wx.showToast({ title: (e && e.message) || '生成对比失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ compareBuildLoading: false })
      })
  },
  closeCompareTable() {
    this.setData({ compareTableOpen: false })
  },
  recalc() {
    const item = this.data.item
    if (!item || item.type !== 'package') {
      this.setData({ price: { base: 0, delta: 0, total: 0, lines: [] }, groupImageUrlsById: {} })
      return
    }
    const base = Number(item.basePrice || 0)
    const lines = []
    let delta = 0
    const optionGroups = (item.optionGroups || []).map((g) => {
      const sel = this.data.selected[g.id]
      const pickIds = Array.isArray(sel) ? sel : sel ? [sel] : []
      const selectedItems = (g.items || []).filter((it) => pickIds.includes(String(it.id)))

      for (const it of selectedItems) {
        const d = Number(it.deltaPrice || 0)
        delta += d
        lines.push({ name: `${g.name}：${it.name}`, delta: d })
      }
      return g
    })

    this.setData({
      item: { ...item, optionGroups },
      price: { base, delta, total: base + delta, lines }
    })
  }
})
