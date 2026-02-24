const { callMpApi } = require('../../utils/cloud')
const { resolveTempUrls, isCloudFileId } = require('../../utils/media')
const { ensureMpLogin } = require('../../utils/auth')

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
    if (!ensureMpLogin({ route: this.route, options: query })) return
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
  openExportDetailMenu() {
    const item = this.data.item
    if (!item || item.type !== 'package') return
    wx.showActionSheet({
      itemList: ['复制文本（含价格）', '导出长截图'],
      success: (res) => {
        const idx = Number(res.tapIndex || 0)
        if (idx === 0) this.exportDetailText()
        if (idx === 1) this.exportDetailImage()
      },
    })
  },
  openExportCompareMenu() {
    if (!this.data.compareTableOpen) return
    wx.showActionSheet({
      itemList: ['复制 CSV', '导出图片'],
      success: (res) => {
        const idx = Number(res.tapIndex || 0)
        if (idx === 0) this.exportCompareCsv()
        if (idx === 1) this.exportCompareImage()
      },
    })
  },
  copyText(text) {
    const s = String(text || '')
    if (!s) {
      wx.showToast({ title: '无可导出内容', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: s,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败', icon: 'none' }),
    })
  },
  buildDetailExportText() {
    const item = this.data.item
    if (!item || item.type !== 'package') return ''
    const lines = []
    const base = Number(item.basePrice || 0)
    const total = Number((this.data.price && this.data.price.total) || base)
    lines.push(`${item.title} / 基础价¥${base} / 当前总价¥${total}`)
    lines.push(`分类：${item.category}`)
    lines.push('')

    lines.push('【套餐内容】')
    for (const g of item.includedGroups || []) {
      const gn = String(g && g.name ? g.name : '').trim() || '套餐内容'
      const parts = ((g && g.items) || [])
        .map((it) => {
          const name = String(it && it.name ? it.name : '').trim()
          if (!name) return ''
          const qty = String(it && it.qtyText ? it.qtyText : this.formatQtyText(it && it.qty)).trim()
          return qty ? `${name}${qty}` : name
        })
        .filter(Boolean)
      lines.push(`${gn}：${parts.length ? parts.join('、') : '-'}`)
    }
    if (!(item.includedGroups || []).length) lines.push('（无）')

    lines.push('')
    lines.push('【已选可选项】')
    for (const g of item.optionGroups || []) {
      const gn = String(g && g.name ? g.name : '').trim()
      if (!gn) continue
      const sel = this.data.selected[g.id]
      const pickIds = Array.isArray(sel) ? sel : sel ? [sel] : []
      const selectedItems = (g.items || []).filter((it) => pickIds.includes(String(it.id)))
      const parts = selectedItems
        .map((it) => {
          const name = String(it && it.name ? it.name : '').trim()
          if (!name) return ''
          const qty = String(it && it.qtyText ? it.qtyText : this.formatQtyText(it && it.qty)).trim()
          const d = Number(it && it.deltaPrice ? it.deltaPrice : 0)
          const priceText = d >= 0 ? `+¥${Math.abs(d)}` : `-¥${Math.abs(d)}`
          return `${qty ? name + qty : name} (${priceText})`
        })
        .filter(Boolean)
      lines.push(`${gn}：${parts.length ? parts.join('、') : '-'}`)
    }
    if (!(item.optionGroups || []).length) lines.push('（无）')

    lines.push('')
    lines.push('【价格明细】')
    lines.push(`基础价：¥${base}`)
    const plines = (this.data.price && this.data.price.lines) || []
    for (const x of plines) {
      const d = Number(x && x.delta ? x.delta : 0)
      const priceText = d >= 0 ? `+¥${Math.abs(d)}` : `-¥${Math.abs(d)}`
      lines.push(`${x.name} ${priceText}`)
    }
    lines.push(`合计：¥${total}`)
    return lines.join('\n')
  },
  exportDetailText() {
    this.copyText(this.buildDetailExportText())
  },
  csvCell(v) {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  },
  buildCompareCsv() {
    const pkgs = this.data.comparePackages || []
    const rows = this.data.compareRows || []
    const header = ['条目', ...pkgs.map((p) => String(p.title || ''))]
    const lines = [header]
    for (const r of rows) {
      const cells = Array.isArray(r.cells) ? r.cells : []
      lines.push([String(r.label || ''), ...cells.map((c) => String(c || '-'))])
    }
    const csv = '\ufeff' + lines.map((arr) => arr.map((x) => this.csvCell(x)).join(',')).join('\n')
    return csv
  },
  exportCompareCsv() {
    this.copyText(this.buildCompareCsv())
  },
  getCanvasNode() {
    if (this._exportCanvas && this._exportCtx) return Promise.resolve({ canvas: this._exportCanvas, ctx: this._exportCtx })
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#exportCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const node = res && res[0] ? res[0].node : null
          if (!node) {
            reject(new Error('获取画布失败'))
            return
          }
          const ctx = node.getContext('2d')
          this._exportCanvas = node
          this._exportCtx = ctx
          resolve({ canvas: node, ctx })
        })
    })
  },
  wrapText(ctx, text, maxWidth) {
    const s = String(text || '')
    if (!s) return ['']
    const out = []
    let line = ''
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      const next = line + ch
      if (ctx.measureText(next).width <= maxWidth) {
        line = next
      } else {
        if (line) out.push(line)
        line = ch
      }
    }
    if (line) out.push(line)
    return out.length ? out : ['']
  },
  canvasToTempFile(canvas, widthPx, heightPx) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width: widthPx,
        height: heightPx,
        destWidth: widthPx,
        destHeight: heightPx,
        fileType: 'png',
        success: (res) => resolve(res.tempFilePath),
        fail: (e) => reject(e),
      })
    })
  },
  ensureAlbumAuth() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (s) => {
          const ok = s && s.authSetting ? s.authSetting['scope.writePhotosAlbum'] : false
          if (ok) {
            resolve(true)
            return
          }
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => resolve(true),
            fail: () => reject(new Error('未授权保存到相册')),
          })
        },
        fail: () => reject(new Error('获取权限失败')),
      })
    })
  },
  saveImageToAlbum(filePath) {
    return this.ensureAlbumAuth()
      .then(() =>
        new Promise((resolve, reject) => {
          wx.saveImageToPhotosAlbum({
            filePath,
            success: () => resolve(true),
            fail: (e) => reject(e),
          })
        }),
      )
      .catch(() => {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中开启“保存到相册”权限后重试',
          confirmText: '去设置',
          success: (r) => {
            if (r.confirm) wx.openSetting({})
          },
        })
        throw new Error('未授权')
      })
  },
  exportDetailImage() {
    const item = this.data.item
    if (!item || item.type !== 'package') return
    wx.showLoading({ title: '生成中…' })
    const info = wx.getSystemInfoSync()
    const dpr = Number(info.pixelRatio || 2)
    const screenW = Number(info.windowWidth || 375)
    const rpx = screenW / 750

    const widthPx = Math.max(320, Math.floor(screenW * 0.94))
    const maxCanvasH = 12000

    const bg = '#f3f4f6'
    const cardBg = '#ffffff'

    const m24 = Math.round(24 * rpx)
    const p24 = Math.round(24 * rpx)
    const gap16 = Math.round(16 * rpx)
    const gap20 = Math.round(20 * rpx)
    const gap12 = Math.round(12 * rpx)
    const br20 = Math.round(20 * rpx)
    const br18 = Math.round(18 * rpx)
    const bw2 = Math.max(1, Math.round(2 * rpx))

    const heroH = Math.round(widthPx * 1.25)

    const font34 = Math.round(34 * rpx)
    const font30 = Math.round(30 * rpx)
    const font26 = Math.round(26 * rpx)
    const font24 = Math.round(24 * rpx)
    const font22 = Math.round(22 * rpx)

    const fmtDelta = (d) => {
      const n = Number(d || 0)
      return n >= 0 ? `+¥${Math.abs(n)}` : `-¥${Math.abs(n)}`
    }

    const roundRectPath = (ctx, x, y, w, h, r) => {
      const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2))
      ctx.beginPath()
      ctx.moveTo(x + rr, y)
      ctx.arcTo(x + w, y, x + w, y + h, rr)
      ctx.arcTo(x + w, y + h, x, y + h, rr)
      ctx.arcTo(x, y + h, x, y, rr)
      ctx.arcTo(x, y, x + w, y, rr)
      ctx.closePath()
    }

    const drawPill = (ctx, x, y, text, bgColor) => {
      const padX = Math.round(10 * rpx)
      const padY = Math.round(6 * rpx)
      ctx.font = `${font22}px sans-serif`
      const w = Math.ceil(ctx.measureText(text).width) + padX * 2
      const h = font22 + padY * 2
      ctx.fillStyle = bgColor
      roundRectPath(ctx, x, y, w, h, h / 2)
      ctx.fill()
      ctx.fillStyle = '#6b7280'
      ctx.fillText(text, x + padX, y + padY + font22)
      return { w, h }
    }

    const getImagePath = (src) => {
      const s = String(src || '').trim()
      if (!s) return Promise.resolve('')
      if (!this._imgPathCache) this._imgPathCache = new Map()
      if (this._imgPathCache.has(s)) return Promise.resolve(this._imgPathCache.get(s))
      return new Promise((resolve) => {
        wx.getImageInfo({
          src: s,
          success: (res) => {
            const p = (res && res.path) || ''
            this._imgPathCache.set(s, p)
            resolve(p)
          },
          fail: () => {
            this._imgPathCache.set(s, '')
            resolve('')
          },
        })
      })
    }

    const loadImage = (canvas, src) =>
      getImagePath(src).then(
        (p) =>
          new Promise((resolve) => {
            if (!p) {
              resolve(null)
              return
            }
            const img = canvas.createImage()
            img.onload = () => resolve(img)
            img.onerror = () => resolve(null)
            img.src = p
          }),
      )

    const drawCover = (ctx, img, x, y, w, h) => {
      if (!img) {
        ctx.fillStyle = '#111827'
        ctx.fillRect(x, y, w, h)
        return
      }
      const iw = img.width || 1
      const ih = img.height || 1
      const scale = Math.max(w / iw, h / ih)
      const sw = Math.ceil(w / scale)
      const sh = Math.ceil(h / scale)
      const sx = Math.max(0, Math.floor((iw - sw) / 2))
      const sy = Math.max(0, Math.floor((ih - sh) / 2))
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
    }

    const drawFit = (ctx, img, x, y, w, h) => {
      if (!img) {
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = '#6b7280'
        ctx.font = `${font22}px sans-serif`
        ctx.fillText('无图', x + Math.round(10 * rpx), y + Math.round(24 * rpx))
        return
      }
      const iw = img.width || 1
      const ih = img.height || 1
      const scale = Math.min(w / iw, h / ih)
      const dw = iw * scale
      const dh = ih * scale
      const dx = x + (w - dw) / 2
      const dy = y + (h - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
    }

    const drawTextClamp = (ctx, text, x, y, maxW, fontPx, color, maxLines) => {
      ctx.font = `${fontPx}px sans-serif`
      ctx.fillStyle = color
      const lines = this.wrapText(ctx, String(text || ''), maxW)
      const out = lines.slice(0, maxLines)
      for (let i = 0; i < out.length; i++) {
        ctx.fillText(out[i], x, y + fontPx + i * (fontPx + Math.round(6 * rpx)))
      }
      return out.length
    }

    const itemCardW = widthPx - m24 * 2
    const optionImgH = Math.round(180 * rpx)
    const optionTextH = Math.round(140 * rpx)
    const optionPad = Math.round(14 * rpx)
    const optionCardH = optionImgH + optionTextH
    const optionGap = gap12
    const innerW = itemCardW - p24 * 2
    const colW = Math.floor((innerW - optionGap) / 2)

    const includeGroupCardH = (g) => {
      const items = (g.items || []).length
      const rows = Math.ceil(items / 2)
      return p24 + font30 + gap16 + rows * optionCardH + Math.max(0, rows - 1) * optionGap + p24
    }

    const getSelectedOptionItems = (g) => {
      const sel = this.data.selected && this.data.selected[g.id]
      const pickIds = Array.isArray(sel) ? sel : sel ? [sel] : []
      return (g.items || []).filter((it) => pickIds.includes(String(it.id)))
    }

    const optionGroupCardH = (g, items) => {
      const count = (items || []).length
      const rows = Math.ceil(count / 2)
      return p24 + font30 + gap16 + rows * optionCardH + Math.max(0, rows - 1) * optionGap + p24
    }

    const headerCardH = () => {
      const baseH = p24 + font34 + gap16 + Math.round(30 * rpx) + p24
      const extra = item.description ? Math.round(38 * rpx) + gap12 : 0
      const priceH = Math.round(34 * rpx) + gap12
      return baseH + extra + (item.type === 'package' ? priceH : 0)
    }

    const contentTitleH = gap20 + font30 + gap12
    const includeH = (item.includedGroups || []).reduce((sum, g) => sum + includeGroupCardH(g) + gap16, 0)

    const selectedOptionGroups = (item.optionGroups || [])
      .map((g) => ({ g, items: getSelectedOptionItems(g) }))
      .filter((x) => x.items.length)

    const optionH = selectedOptionGroups.reduce((sum, x) => sum + optionGroupCardH(x.g, x.items) + gap16, 0)
    const hasOption = selectedOptionGroups.length > 0
    const totalH = heroH + gap20 + headerCardH() + contentTitleH + includeH + (hasOption ? contentTitleH + optionH : 0) + gap20
    if (totalH > maxCanvasH) {
      wx.hideLoading()
      wx.showToast({ title: '内容过多，无法导出长截图', icon: 'none' })
      return
    }

    return this.getCanvasNode()
      .then(({ canvas, ctx }) => {
        canvas.width = Math.round(widthPx * dpr)
        canvas.height = Math.round(totalH * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        ctx.fillStyle = bg
        ctx.fillRect(0, 0, widthPx, totalH)

        const heroSrc = (() => {
          const ml = item.mediaList || []
          const idx = Number(this.data.swiperIndex || 0)
          const m = ml[idx]
          if (m && m.kind === 'image' && m.url) return m.url
          if (item.coverUrl) return item.coverUrl
          return ''
        })()

        return loadImage(canvas, heroSrc).then((heroImg) => {
          drawCover(ctx, heroImg, 0, 0, widthPx, heroH)

          let y = heroH + gap20
          const x = m24

          ctx.fillStyle = cardBg
          roundRectPath(ctx, x, y, itemCardW, headerCardH(), br20)
          ctx.fill()

          let cy = y + p24
          drawTextClamp(ctx, item.title, x + p24, cy, itemCardW - p24 * 2, font34, '#111827', 2)
          cy += font34 + gap16

          let px = x + p24
          const pill1 = drawPill(ctx, px, cy, String(item.category || ''), '#f3f4f6')
          px += pill1.w + Math.round(10 * rpx)
          drawPill(ctx, px, cy, '服务', '#f3f4f6')
          cy += pill1.h + gap12

          if (item.type === 'package') {
            ctx.fillStyle = '#6b7280'
            ctx.font = `${font24}px sans-serif`
            ctx.fillText(`基础价 ¥ ${Number(item.basePrice || 0)}`, x + p24, cy + font24)
            const total = Number((this.data.price && this.data.price.total) || Number(item.basePrice || 0))
            const totalText = `¥ ${total}`
            ctx.fillStyle = '#ef4444'
            ctx.font = `${font34}px sans-serif`
            const tw = ctx.measureText(totalText).width
            ctx.fillText(totalText, x + itemCardW - p24 - tw, cy + font34)
            cy += font34 + gap12
          }

          if (item.description) {
            drawTextClamp(ctx, item.description, x + p24, cy, itemCardW - p24 * 2, font26, '#374151', 10)
          }

          y += headerCardH() + gap20

          ctx.fillStyle = '#111827'
          ctx.font = `${font30}px sans-serif`
          ctx.fillText('套餐内容', x, y + font30)
          y += font30 + gap12

          const drawIncludeGroup = (g) => {
            const gh = includeGroupCardH(g)
            ctx.fillStyle = cardBg
            roundRectPath(ctx, x, y, itemCardW, gh, br20)
            ctx.fill()
            ctx.fillStyle = '#111827'
            ctx.font = `${font30}px sans-serif`
            ctx.fillText(String(g.name || ''), x + p24, y + p24 + font30)
            const startY = y + p24 + font30 + gap16
            const items = g.items || []
            return Promise.all(
              items.map((it, idx) => {
                const col = idx % 2
                const row = Math.floor(idx / 2)
                const bx = x + p24 + col * (colW + optionGap)
                const by = startY + row * (optionCardH + optionGap)
                const bw = colW
                const bh = optionCardH
                ctx.fillStyle = '#ffffff'
                roundRectPath(ctx, bx, by, bw, bh, br18)
                ctx.fill()
                ctx.strokeStyle = '#e5e7eb'
                ctx.lineWidth = bw2
                roundRectPath(ctx, bx, by, bw, bh, br18)
                ctx.stroke()
                ctx.fillStyle = '#f3f4f6'
                ctx.fillRect(bx, by, bw, optionImgH)

                const thumb = it.thumbKind === 'image' ? it.thumbUrl : ''
                if (it.thumbKind === 'video') {
                  ctx.fillStyle = 'rgba(0,0,0,0.25)'
                  ctx.fillRect(bx, by, bw, optionImgH)
                  ctx.fillStyle = '#ffffff'
                  ctx.font = `${font24}px sans-serif`
                  ctx.fillText('视频', bx + Math.round(10 * rpx), by + Math.round(30 * rpx))
                  return Promise.resolve()
                }

                return loadImage(canvas, thumb).then((img) => {
                  drawFit(ctx, img, bx, by, bw, optionImgH)
                })
              }),
            ).then(() => {
              for (let idx = 0; idx < items.length; idx++) {
                const it = items[idx]
                const col = idx % 2
                const row = Math.floor(idx / 2)
                const bx = x + p24 + col * (colW + optionGap)
                const by = startY + row * (optionCardH + optionGap)
                const textX = bx + optionPad
                const textY = by + optionImgH + optionPad
                ctx.fillStyle = '#111827'
                ctx.font = `${font26}px sans-serif`
                ctx.fillText(`${it.name || ''}${it.qtyText || ''}`, textX, textY + font26)
                if (it.description) {
                  ctx.fillStyle = '#6b7280'
                  ctx.font = `${font22}px sans-serif`
                  const desc = this.wrapText(ctx, String(it.description || ''), colW - optionPad * 2).slice(0, 2)
                  for (let i = 0; i < desc.length; i++) {
                    ctx.fillText(
                      desc[i],
                      textX,
                      textY + font26 + Math.round(8 * rpx) + font22 + i * (font22 + Math.round(8 * rpx)),
                    )
                  }
                }
              }
              y += gh + gap16
            })
          }

          const seqGroups = (groups) => {
            let p = Promise.resolve()
            for (const g of groups) p = p.then(() => drawIncludeGroup(g))
            return p
          }

          return seqGroups(item.includedGroups || []).then(() => {
            if (!hasOption) return this.canvasToTempFile(canvas, widthPx, totalH)

            ctx.fillStyle = '#111827'
            ctx.font = `${font30}px sans-serif`
            ctx.fillText('可选项', x, y + font30)
            y += font30 + gap12

            const drawOptionGroup = (g, items) => {
              const gh = optionGroupCardH(g, items)
              ctx.fillStyle = cardBg
              roundRectPath(ctx, x, y, itemCardW, gh, br20)
              ctx.fill()
              ctx.fillStyle = '#111827'
              ctx.font = `${font30}px sans-serif`
              ctx.fillText(String(g.name || ''), x + p24, y + p24 + font30)

              const startY = y + p24 + font30 + gap16
              return Promise.all(
                items.map((it, idx) => {
                  const col = idx % 2
                  const row = Math.floor(idx / 2)
                  const bx = x + p24 + col * (colW + optionGap)
                  const by = startY + row * (optionCardH + optionGap)
                  const bw = colW
                  const bh = optionCardH
                  ctx.fillStyle = '#ffffff'
                  roundRectPath(ctx, bx, by, bw, bh, br18)
                  ctx.fill()
                  ctx.strokeStyle = '#e5e7eb'
                  ctx.lineWidth = bw2
                  roundRectPath(ctx, bx, by, bw, bh, br18)
                  ctx.stroke()
                  ctx.fillStyle = '#f3f4f6'
                  ctx.fillRect(bx, by, bw, optionImgH)

                  const thumb = it.thumbKind === 'image' ? it.thumbUrl : ''
                  if (it.thumbKind === 'video') {
                    ctx.fillStyle = 'rgba(0,0,0,0.25)'
                    ctx.fillRect(bx, by, bw, optionImgH)
                    ctx.fillStyle = '#ffffff'
                    ctx.font = `${font24}px sans-serif`
                    ctx.fillText('视频', bx + Math.round(10 * rpx), by + Math.round(30 * rpx))
                    return Promise.resolve()
                  }
                  return loadImage(canvas, thumb).then((img) => {
                    drawFit(ctx, img, bx, by, bw, optionImgH)
                  })
                }),
              ).then(() => {
                for (let idx = 0; idx < items.length; idx++) {
                  const it = items[idx]
                  const col = idx % 2
                  const row = Math.floor(idx / 2)
                  const bx = x + p24 + col * (colW + optionGap)
                  const by = startY + row * (optionCardH + optionGap)
                  const textX = bx + optionPad
                  const textY = by + optionImgH + optionPad
                  ctx.fillStyle = '#111827'
                  ctx.font = `${font26}px sans-serif`
                  ctx.fillText(`${it.name || ''}${it.qtyText || ''}`, textX, textY + font26)
                  if (it.description) {
                    ctx.fillStyle = '#6b7280'
                    ctx.font = `${font22}px sans-serif`
                    const desc = this.wrapText(ctx, String(it.description || ''), colW - optionPad * 2).slice(0, 2)
                    for (let i = 0; i < desc.length; i++) {
                      ctx.fillText(
                        desc[i],
                        textX,
                        textY + font26 + Math.round(8 * rpx) + font22 + i * (font22 + Math.round(8 * rpx)),
                      )
                    }
                  }
                  ctx.fillStyle = '#ef4444'
                  ctx.font = `${font24}px sans-serif`
                  ctx.fillText(fmtDelta(it.deltaPrice), textX, by + optionImgH + optionTextH - optionPad)
                }
                y += gh + gap16
              })
            }

            let p = Promise.resolve()
            for (const xg of selectedOptionGroups) p = p.then(() => drawOptionGroup(xg.g, xg.items))
            return p.then(() => this.canvasToTempFile(canvas, widthPx, totalH))
          })
        })
      })
      .then((filePath) => this.saveImageToAlbum(filePath))
      .then(() => wx.showToast({ title: '已保存到相册', icon: 'success' }))
      .catch((e) => {
        const msg = e && e.message ? e.message : '导出失败'
        wx.showToast({ title: msg, icon: 'none' })
      })
      .finally(() => wx.hideLoading())
  },
  exportCompareImage() {
    const pkgs = this.data.comparePackages || []
    const rows = this.data.compareRows || []
    if (!pkgs.length) return
    const info = wx.getSystemInfoSync()
    const maxCanvasW = 1600
    const maxCanvasH = 8000
    const padding = 16
    const font = 12
    const headerFont = 13
    const rowH = 28
    const headerH = 34

    const cols = 1 + pkgs.length
    let colW = 200
    let labelW = 220
    let widthPx = padding * 2 + labelW + pkgs.length * colW
    if (widthPx > maxCanvasW) {
      const avail = maxCanvasW - padding * 2 - labelW
      colW = Math.floor(avail / Math.max(1, pkgs.length))
      if (colW < 120) {
        wx.showToast({ title: '对比套餐过多，无法导出图片', icon: 'none' })
        return
      }
      widthPx = padding * 2 + labelW + pkgs.length * colW
    }

    const heightPx = padding * 2 + headerH + rows.length * rowH
    if (heightPx > maxCanvasH) {
      wx.showToast({ title: '对比条目过多，无法导出图片', icon: 'none' })
      return
    }

    wx.showLoading({ title: '生成中…' })
    return this.getCanvasNode()
      .then(({ canvas, ctx }) => {
        const dpr = Number(info.pixelRatio || 2)
        canvas.width = Math.round(widthPx * dpr)
        canvas.height = Math.round(heightPx * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, widthPx, heightPx)

        const x0 = padding
        let y = padding

        ctx.fillStyle = '#111827'
        ctx.font = `${headerFont}px sans-serif`
        ctx.fillText('条目', x0 + 4, y + 22)
        for (let i = 0; i < pkgs.length; i++) {
          const x = x0 + labelW + i * colW
          const title = String(pkgs[i].title || '')
          const tlines = this.wrapText(ctx, title, colW - 8).slice(0, 2)
          ctx.fillText(tlines[0] || '', x + 4, y + 18)
          if (tlines[1]) ctx.fillText(tlines[1], x + 4, y + 32)
        }

        y += headerH
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(widthPx - padding, y)
        ctx.stroke()

        ctx.font = `${font}px sans-serif`
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r]
          const ry = y + r * rowH
          ctx.fillStyle = '#111827'
          const label = String(row.label || '')
          const l1 = this.wrapText(ctx, label, labelW - 8)[0] || ''
          ctx.fillText(l1, x0 + 4, ry + 19)
          for (let c = 0; c < pkgs.length; c++) {
            const x = x0 + labelW + c * colW
            const v = row.cells && row.cells[c] != null ? String(row.cells[c]) : '-'
            const v1 = this.wrapText(ctx, v, colW - 8)[0] || ''
            ctx.fillText(v1, x + 4, ry + 19)
          }
          ctx.strokeStyle = '#f3f4f6'
          ctx.beginPath()
          ctx.moveTo(x0, ry + rowH)
          ctx.lineTo(widthPx - padding, ry + rowH)
          ctx.stroke()
        }

        return this.canvasToTempFile(canvas, widthPx, heightPx)
      })
      .then((filePath) => this.saveImageToAlbum(filePath))
      .then(() => wx.showToast({ title: '已保存到相册', icon: 'success' }))
      .catch(() => wx.showToast({ title: '导出失败', icon: 'none' }))
      .finally(() => wx.hideLoading())
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
            basePrice: Number(x.basePrice || 0),
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
          comparePackages: pkgs.map((p) => ({
            id: p.id,
            title: `${p.title}/${Number(p.basePrice || 0)}`,
          })),
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
