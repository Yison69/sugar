const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const ok = (data) => data

const now = () => Date.now()

const isCloudFileId = (v) => typeof v === 'string' && v.startsWith('cloud://')

async function resolveCloudFileIds(fileIds) {
  const uniq = Array.from(new Set((fileIds || []).filter(isCloudFileId)))
  if (!uniq.length) return new Map()
  const res = await cloud.getTempFileURL({ fileList: uniq }).catch(() => null)
  const list = (res && res.fileList) || []
  const m = new Map()
  for (const it of list) {
    if (it && it.fileID && it.tempFileURL) m.set(it.fileID, it.tempFileURL)
  }
  return m
}

function replaceWithTempUrl(v, map) {
  if (!isCloudFileId(v)) return v
  return map.get(v) || v
}

async function getOpenid() {
  const ctx = cloud.getWXContext()
  return ctx.OPENID
}

async function listItems({ category, type }) {
  const openid = await getOpenid()

  const workWhere = { category, isPublished: true }
  const pkgWhere = { category, isPublished: true }

  const [worksRes, pkgsRes] = await Promise.all([
    type === 'package' ? Promise.resolve({ data: [] }) : db.collection('works').where(workWhere).orderBy('createdAt', 'desc').limit(50).get(),
    type === 'work' ? Promise.resolve({ data: [] }) : db.collection('packages').where(pkgWhere).orderBy('createdAt', 'desc').limit(50).get()
  ])

  const works = (worksRes.data || []).map((d) => ({
    id: d._id,
    type: 'work',
    title: d.title,
    category: d.category,
    coverUrl: d.coverUrl,
    likeCount: d.likeCount || 0
  }))
  const pkgs = (pkgsRes.data || []).map((d) => ({
    id: d._id,
    type: 'package',
    title: d.title,
    category: d.category,
    coverUrl: d.coverUrl,
    basePrice: d.basePrice || 0,
    likeCount: d.likeCount || 0
  }))

  const items = [...works, ...pkgs].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))

  const coverMap = await resolveCloudFileIds(items.map((x) => x.coverUrl))
  const itemsWithMedia = items.map((x) => ({ ...x, coverUrl: replaceWithTempUrl(x.coverUrl, coverMap) }))
  const ids = items.map((x) => x.id)
  if (!openid || !ids.length) {
    return ok({ items: itemsWithMedia.map((x) => ({ ...x, isLiked: false })) })
  }

  const likesRes = await db
    .collection('likes')
    .where({ userOpenid: openid, targetId: _.in(ids) })
    .limit(200)
    .get()

  const likedSet = new Set((likesRes.data || []).map((l) => `${l.targetType}:${l.targetId}`))
  return ok({
    items: itemsWithMedia.map((x) => ({
      ...x,
      isLiked: likedSet.has(`${x.type}:${x.id}`)
    }))
  })
}

async function getItemDetail({ id, type }) {
  const openid = await getOpenid()
  const col = type === 'package' ? 'packages' : 'works'
  const docRes = await db.collection(col).doc(id).get().catch(() => null)
  const d = docRes && docRes.data
  if (!d || !d.isPublished) return ok({ item: null })

  const likeRes = openid
    ? await db
        .collection('likes')
        .where({ userOpenid: openid, targetType: type, targetId: id })
        .limit(1)
        .get()
    : { data: [] }

  const isLiked = !!((likeRes.data || []).length)

  const base = {
    id: d._id,
    type,
    title: d.title,
    category: d.category,
    coverUrl: d.coverUrl,
    mediaUrls: d.imageUrls && d.imageUrls.length ? d.imageUrls : [d.coverUrl].filter(Boolean),
    description: d.description || '',
    likeCount: d.likeCount || 0,
    isLiked
  }

  const mediaMap = await resolveCloudFileIds([base.coverUrl, ...(base.mediaUrls || [])])
  const baseWithMedia = {
    ...base,
    coverUrl: replaceWithTempUrl(base.coverUrl, mediaMap),
    mediaUrls: (base.mediaUrls || []).map((u) => replaceWithTempUrl(u, mediaMap))
  }

  if (type === 'package') {
    return ok({
      item: {
        ...baseWithMedia,
        basePrice: d.basePrice || 0,
        deliverables: d.deliverables || '',
        optionGroups: d.optionGroups || []
      }
    })
  }

  return ok({ item: baseWithMedia })
}

async function toggleLike({ targetId, targetType }) {
  const openid = await getOpenid()
  if (!openid) throw new Error('未登录')
  if (!targetId || (targetType !== 'work' && targetType !== 'package')) throw new Error('参数错误')

  const likesCol = db.collection('likes')
  const found = await likesCol.where({ userOpenid: openid, targetId, targetType }).limit(1).get()
  const exists = (found.data || [])[0]

  const targetCol = db.collection(targetType === 'work' ? 'works' : 'packages')

  if (exists) {
    await likesCol.doc(exists._id).remove()
    await targetCol.doc(targetId).update({ data: { likeCount: _.inc(-1), updatedAt: now() } }).catch(() => {})
    const latest = await targetCol.doc(targetId).get().catch(() => null)
    const likeCount = latest && latest.data ? latest.data.likeCount || 0 : 0
    if (likeCount < 0) {
      await targetCol.doc(targetId).update({ data: { likeCount: 0, updatedAt: now() } }).catch(() => {})
      return ok({ liked: false, likeCount: 0 })
    }
    return ok({ liked: false, likeCount })
  }

  await likesCol.add({
    data: {
      userOpenid: openid,
      targetType,
      targetId,
      createdAt: now()
    }
  })
  await targetCol.doc(targetId).update({ data: { likeCount: _.inc(1), updatedAt: now() } }).catch(() => {})
  const latest = await targetCol.doc(targetId).get().catch(() => null)
  const likeCount = latest && latest.data ? latest.data.likeCount || 0 : 0
  return ok({ liked: true, likeCount: Math.max(0, likeCount) })
}

async function createBooking(payload) {
  const openid = await getOpenid()
  if (!openid) throw new Error('未登录')

  const required = ['itemType', 'itemId', 'itemTitleSnapshot', 'contactName', 'contactPhone', 'contactWechat', 'shootingType', 'scheduledAt']
  for (const k of required) {
    if (!payload || !payload[k]) throw new Error('请完善预约信息')
  }

  let computedSelected = payload.selectedOptionsSnapshot || null
  let computedPrice = payload.priceSnapshot || null

  if (payload.itemType === 'package') {
    const pkgRes = await db.collection('packages').doc(payload.itemId).get().catch(() => null)
    const pkg = pkgRes && pkgRes.data
    if (!pkg || !pkg.isPublished) throw new Error('套餐不存在或已下架')

    const optionGroups = pkg.optionGroups || []
    const selected = computedSelected || {}
    for (const g of optionGroups) {
      if (!g.required) continue
      const v = selected[g.id]
      const okSel = Array.isArray(v) ? v.length > 0 : !!v
      if (!okSel) throw new Error(`请完成必选项：${g.name}`)
    }

    const base = Number(pkg.basePrice || 0)
    let delta = 0
    const lines = []
    for (const g of optionGroups) {
      const v = selected[g.id]
      const pickIds = Array.isArray(v) ? v : v ? [v] : []
      for (const pid of pickIds) {
        const it = (g.items || []).find((x) => x.id === pid)
        if (!it) continue
        const d = Number(it.deltaPrice || 0)
        delta += d
        lines.push({ name: `${g.name}：${it.name}`, delta: d })
      }
    }
    computedSelected = selected
    computedPrice = { base, delta, total: base + delta, lines }
  }

  const doc = {
    userOpenid: openid,
    itemType: payload.itemType,
    itemId: payload.itemId,
    itemTitleSnapshot: payload.itemTitleSnapshot,
    selectedOptionsSnapshot: computedSelected,
    priceSnapshot: computedPrice,
    contactName: payload.contactName,
    contactPhone: payload.contactPhone,
    contactWechat: payload.contactWechat,
    shootingType: payload.shootingType,
    scheduledAt: payload.scheduledAt,
    remark: payload.remark || '',
    status: '待确认',
    createdAt: now(),
    updatedAt: now()
  }
  const res = await db.collection('bookings').add({ data: doc })
  return ok({ id: res._id })
}

async function getMyBookings() {
  const openid = await getOpenid()
  if (!openid) return ok({ items: [] })
  const res = await db.collection('bookings').where({ userOpenid: openid }).orderBy('createdAt', 'desc').limit(50).get()
  const items = (res.data || []).map((d) => ({
    id: d._id,
    itemType: d.itemType,
    itemId: d.itemId,
    itemTitleSnapshot: d.itemTitleSnapshot,
    shootingType: d.shootingType,
    scheduledAt: d.scheduledAt,
    status: d.status,
    createdAt: d.createdAt
  }))
  return ok({ items })
}

async function getContactConfig() {
  const res = await db.collection('config').doc('contact').get().catch(() => null)
  const d = res && res.data
  const m = await resolveCloudFileIds([d && d.wechatQrUrl])
  return ok({
    wechatText: (d && d.wechatText) || '',
    wechatQrUrl: replaceWithTempUrl((d && d.wechatQrUrl) || '', m)
  })
}

exports.main = async (event) => {
  const action = event.action
  const data = event.data || {}

  if (action === 'login') {
    const ctx = cloud.getWXContext()
    return ok({ openid: ctx.OPENID })
  }
  if (action === 'listItems') return listItems(data)
  if (action === 'getItemDetail') return getItemDetail(data)
  if (action === 'toggleLike') return toggleLike(data)
  if (action === 'createBooking') return createBooking(data)
  if (action === 'getMyBookings') return getMyBookings()
  if (action === 'getContactConfig') return getContactConfig()

  throw new Error('Unknown action')
}
