const { readJsonBody, sendJson, methodNotAllowed } = require('../_lib/http.cjs')
const { getSupabaseAdmin, throwIfError } = require('../_lib/supabase.cjs')

const ok = (res, data) => sendJson(res, 200, data)

const nowIso = () => new Date().toISOString()

const requireUserId = (body) => {
  const userId = String((body && body.userId) || '').trim()
  if (!userId) throw new Error('未登录')
  return userId
}

const fromWorkRow = (r) => ({
  id: r.id,
  type: 'work',
  title: r.title,
  category: r.category,
  coverUrl: r.cover_url || '',
  likeCount: Number(r.like_count || 0),
})

const fromPackageRow = (r) => ({
  id: r.id,
  type: 'package',
  title: r.title,
  category: r.category,
  coverUrl: r.cover_url || '',
  basePrice: Number(r.base_price || 0),
  likeCount: Number(r.like_count || 0),
})

async function listItems(sb, body) {
  const category = String((body && body.category) || '').trim()
  const type = String((body && body.type) || 'all').trim()
  if (!category) return { items: [] }

  const [worksRes, pkgsRes] = await Promise.all([
    type === 'package'
      ? Promise.resolve({ data: [] })
      : throwIfError(
          await sb.from('works').select('*').eq('category', category).eq('is_published', true).order('created_at', { ascending: false }).limit(50),
        ),
    type === 'work'
      ? Promise.resolve({ data: [] })
      : throwIfError(
          await sb
            .from('packages')
            .select('*')
            .eq('category', category)
            .eq('is_published', true)
            .order('created_at', { ascending: false })
            .limit(50),
        ),
  ])

  const works = (worksRes.data || []).map(fromWorkRow)
  const pkgs = (pkgsRes.data || []).map(fromPackageRow)
  const items = [...works, ...pkgs].sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))

  let userId = ''
  try {
    userId = requireUserId(body)
  } catch {
    return { items: items.map((x) => ({ ...x, isLiked: false })) }
  }

  const ids = items.map((x) => x.id)
  if (!ids.length) return { items: [] }

  const likesRes = throwIfError(
    await sb.from('likes').select('target_type, target_id').eq('user_id', userId).in('target_id', ids),
  )
  const likedSet = new Set((likesRes.data || []).map((l) => `${l.target_type}:${l.target_id}`))

  return { items: items.map((x) => ({ ...x, isLiked: likedSet.has(`${x.type}:${x.id}`) })) }
}

async function getItemDetail(sb, body) {
  const id = String((body && body.id) || '').trim()
  const type = String((body && body.type) || '').trim()
  if (!id || (type !== 'work' && type !== 'package')) return { item: null }

  const table = type === 'package' ? 'packages' : 'works'
  const r = await sb.from(table).select('*').eq('id', id).eq('is_published', true).single()
  if (r.error || !r.data) return { item: null }
  const d = r.data

  let isLiked = false
  try {
    const userId = requireUserId(body)
    const lr = await sb
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('target_type', type)
      .eq('target_id', id)
      .limit(1)
    isLiked = !!((lr.data || []).length)
  } catch {
  }

  const rawMedia = type === 'package' ? d.media_urls : d.image_urls
  const mediaUrls = Array.isArray(rawMedia) && rawMedia.length ? rawMedia : [d.cover_url].filter(Boolean)

  const base = {
    id: d.id,
    type,
    title: d.title,
    category: d.category,
    coverUrl: d.cover_url || '',
    mediaUrls,
    description: d.description || '',
    likeCount: Number(d.like_count || 0),
    isLiked,
  }

  if (type === 'package') {
    return {
      item: {
        ...base,
        basePrice: Number(d.base_price || 0),
        deliverables: d.deliverables || '',
        includedGroups: d.included_groups || [],
        optionGroups: d.option_groups || [],
      },
    }
  }

  return { item: base }
}

async function toggleLike(sb, body) {
  const userId = requireUserId(body)
  const targetId = String((body && body.targetId) || '').trim()
  const targetType = String((body && body.targetType) || '').trim()
  if (!targetId || (targetType !== 'work' && targetType !== 'package')) throw new Error('参数错误')

  const found = await sb
    .from('likes')
    .select('id')
    .eq('user_id', userId)
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
    return { liked: false, likeCount: next }
  }

  await sb.from('likes').insert({ user_id: userId, target_type: targetType, target_id: targetId })
  const current = await sb.from(table).select('like_count').eq('id', targetId).single()
  const next = Math.max(0, Number((current.data && current.data.like_count) || 0) + 1)
  await sb.from(table).update({ like_count: next, updated_at: nowIso() }).eq('id', targetId)
  return { liked: true, likeCount: next }
}

async function getContactConfig(sb) {
  const r = await sb.from('app_config').select('value').eq('key', 'contact').single()
  if (r.error || !r.data) return { wechatText: '', wechatQrUrl: '' }
  return r.data.value || { wechatText: '', wechatQrUrl: '' }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res)
  const body = await readJsonBody(req)
  if (!body || typeof body.action !== 'string') return ok(res, { error: '参数错误' })

  const sb = getSupabaseAdmin()
  try {
    const action = body.action
    if (action === 'listItems') return ok(res, await listItems(sb, body.data || body))
    if (action === 'getItemDetail') return ok(res, await getItemDetail(sb, body.data || body))
    if (action === 'toggleLike') return ok(res, await toggleLike(sb, body.data || body))
    if (action === 'getContactConfig') return ok(res, await getContactConfig(sb))
    return ok(res, { error: 'Unknown action' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return ok(res, { error: msg })
  }
}
