const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

try {
  if (!globalThis.fetch) globalThis.fetch = require('undici').fetch
} catch (_) {}

const { createClient } = require('@supabase/supabase-js')

const requiredEnv = (name) => {
  const v = (process.env[name] || '').trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

const getSb = () => {
  const url = requiredEnv('SUPABASE_URL')
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

const ok = (data) => data

const nowIso = () => new Date().toISOString()

const getOpenid = () => {
  const ctx = cloud.getWXContext()
  return ctx.OPENID
}

async function listItems({ category, type }) {
  const openid = getOpenid()
  const sb = getSb()

  const [worksRes, pkgsRes] = await Promise.all([
    type === 'package'
      ? Promise.resolve({ data: [] })
      : sb.from('works').select('*').eq('category', category).eq('is_published', true).order('created_at', { ascending: false }).limit(50),
    type === 'work'
      ? Promise.resolve({ data: [] })
      : sb
          .from('packages')
          .select('*')
          .eq('category', category)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(50)
  ])

  if ((worksRes && worksRes.error) || (pkgsRes && pkgsRes.error)) throw new Error('加载失败')

  const works = (worksRes.data || []).map((d) => ({
    id: d.id,
    type: 'work',
    title: d.title,
    category: d.category,
    coverUrl: d.cover_url || '',
    likeCount: Number(d.like_count || 0)
  }))
  const pkgs = (pkgsRes.data || []).map((d) => ({
    id: d.id,
    type: 'package',
    title: d.title,
    category: d.category,
    coverUrl: d.cover_url || '',
    basePrice: Number(d.base_price || 0),
    likeCount: Number(d.like_count || 0)
  }))

  const items = [...works, ...pkgs].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
  const ids = items.map((x) => x.id)
  if (!openid || !ids.length) return ok({ items: items.map((x) => ({ ...x, isLiked: false })) })

  const likesRes = await sb.from('likes').select('target_type, target_id').eq('user_id', openid).in('target_id', ids)
  if (likesRes.error) return ok({ items: items.map((x) => ({ ...x, isLiked: false })) })
  const likedSet = new Set((likesRes.data || []).map((l) => `${l.target_type}:${l.target_id}`))
  return ok({ items: items.map((x) => ({ ...x, isLiked: likedSet.has(`${x.type}:${x.id}`) })) })
}

async function getItemDetail({ id, type }) {
  const openid = getOpenid()
  const sb = getSb()
  const table = type === 'package' ? 'packages' : 'works'
  const docRes = await sb.from(table).select('*').eq('id', id).eq('is_published', true).single()
  const d = docRes && docRes.data
  if (!d) return ok({ item: null })

  let isLiked = false
  if (openid) {
    const likeRes = await sb
      .from('likes')
      .select('id')
      .eq('user_id', openid)
      .eq('target_type', type)
      .eq('target_id', id)
      .limit(1)
    isLiked = !!((likeRes.data || []).length)
  }

  const mediaUrls = Array.isArray(d.image_urls) && d.image_urls.length ? d.image_urls : [d.cover_url].filter(Boolean)

  const base = {
    id: d.id,
    type,
    title: d.title,
    category: d.category,
    coverUrl: d.cover_url || '',
    mediaUrls,
    description: d.description || '',
    likeCount: Number(d.like_count || 0),
    isLiked
  }

  if (type === 'package') {
    return ok({
      item: {
        ...base,
        basePrice: Number(d.base_price || 0),
        deliverables: d.deliverables || '',
        optionGroups: d.option_groups || []
      }
    })
  }

  return ok({ item: base })
}

async function toggleLike({ targetId, targetType }) {
  const openid = getOpenid()
  if (!openid) throw new Error('未登录')
  if (!targetId || (targetType !== 'work' && targetType !== 'package')) throw new Error('参数错误')

  const sb = getSb()
  const found = await sb
    .from('likes')
    .select('id')
    .eq('user_id', openid)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .limit(1)
  const exists = (found.data || [])[0]

  const table = targetType === 'package' ? 'packages' : 'works'
  if (exists) {
    await sb.from('likes').delete().eq('id', exists.id)
    const current = await sb.from(table).select('like_count').eq('id', targetId).single()
    const next = Math.max(0, Number((current.data && current.data.like_count) || 0) - 1)
    await sb.from(table).update({ like_count: next, updated_at: nowIso() }).eq('id', targetId)
    return ok({ liked: false, likeCount: next })
  }

  await sb.from('likes').insert({ user_id: openid, target_type: targetType, target_id: targetId })
  const current = await sb.from(table).select('like_count').eq('id', targetId).single()
  const next = Math.max(0, Number((current.data && current.data.like_count) || 0) + 1)
  await sb.from(table).update({ like_count: next, updated_at: nowIso() }).eq('id', targetId)
  return ok({ liked: true, likeCount: next })
}

async function createBooking(payload) {
  const openid = getOpenid()
  if (!openid) throw new Error('未登录')

  const required = ['itemType', 'itemId', 'itemTitleSnapshot', 'contactName', 'contactPhone', 'contactWechat', 'shootingType', 'scheduledAt']
  for (const k of required) {
    if (!payload || !payload[k]) throw new Error('请完善预约信息')
  }

  const sb = getSb()

  let computedSelected = payload.selectedOptionsSnapshot || null
  let computedPrice = payload.priceSnapshot || null

  if (payload.itemType === 'package') {
    const pkgRes = await sb.from('packages').select('*').eq('id', payload.itemId).eq('is_published', true).single()
    const pkg = pkgRes && pkgRes.data
    if (!pkg) throw new Error('套餐不存在或已下架')

    const optionGroups = pkg.option_groups || []
    const selected = computedSelected || {}
    for (const g of optionGroups) {
      if (!g || !g.required) continue
      const v = selected[g.id]
      const okSel = Array.isArray(v) ? v.length > 0 : !!v
      if (!okSel) throw new Error(`请完成必选项：${g.name}`)
    }

    const base = Number(pkg.base_price || 0)
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

  const row = {
    user_openid: openid,
    item_type: payload.itemType,
    item_id: payload.itemId,
    item_title_snapshot: payload.itemTitleSnapshot,
    selected_options_snapshot: computedSelected,
    price_snapshot: computedPrice,
    contact_name: payload.contactName,
    contact_phone: payload.contactPhone,
    contact_wechat: payload.contactWechat,
    shooting_type: payload.shootingType,
    scheduled_at: payload.scheduledAt,
    remark: payload.remark || '',
    status: '待确认',
    created_at: nowIso(),
    updated_at: nowIso()
  }

  const ins = await sb.from('bookings').insert(row).select('id').single()
  if (ins.error || !ins.data) throw new Error('提交失败')
  return ok({ id: ins.data.id })
}

async function getMyBookings() {
  const openid = getOpenid()
  if (!openid) return ok({ items: [] })
  const sb = getSb()
  const res = await sb.from('bookings').select('*').eq('user_openid', openid).order('created_at', { ascending: false }).limit(50)
  if (res.error) return ok({ items: [] })
  const items = (res.data || []).map((d) => ({
    id: d.id,
    itemType: d.item_type,
    itemId: d.item_id,
    itemTitleSnapshot: d.item_title_snapshot,
    shootingType: d.shooting_type,
    scheduledAt: d.scheduled_at,
    status: d.status,
    createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now()
  }))
  return ok({ items })
}

async function getContactConfig() {
  const sb = getSb()
  const res = await sb.from('app_config').select('value').eq('key', 'contact').single()
  const v = (res && res.data && res.data.value) || {}
  return ok({ wechatText: String(v.wechatText || ''), wechatQrUrl: String(v.wechatQrUrl || '') })
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
