const bcrypt = require('bcryptjs')
const { readJsonBody, sendJson, methodNotAllowed } = require('../_lib/http.cjs')
const { getSupabaseAdmin, throwIfError } = require('../_lib/supabase.cjs')
const { required } = require('../_lib/env.cjs')
const { signAdminToken, verifyAdminToken } = require('../_lib/auth.cjs')

const nowIso = () => new Date().toISOString()

const requireAdmin = (token) => {
  if (!token) throw new Error('Unauthorized')
  try {
    const p = verifyAdminToken(token)
    if (!p || !p.sub) throw new Error('Unauthorized')
    return p
  } catch {
    throw new Error('Unauthorized')
  }
}

const ok = (res, data) => sendJson(res, 200, data)
const err = (res, message, status = 200) => sendJson(res, status, { error: message })

async function handleSetup(sb, data) {
  const setupKey = String((data && data.setupKey) || '').trim()
  const expected = String(required('ADMIN_SETUP_KEY')).trim()
  if (!setupKey || setupKey !== expected) return { error: 'Forbidden' }

  const username = String((data && data.username) || '').trim()
  const password = String((data && data.password) || '')
  if (!username || !password) return { error: '参数错误' }

  const found = throwIfError(await sb.from('admin_users').select('id').limit(1))
  if ((found.data || []).length) return { error: '管理员已存在' }

  const passwordHash = await bcrypt.hash(password, 10)
  const ins = throwIfError(
    await sb.from('admin_users').insert({ username, password_hash: passwordHash }).select('id').single(),
  )
  return { ok: true, id: ins.data.id }
}

async function handleLogin(sb, data) {
  const username = String((data && data.username) || '').trim()
  const password = String((data && data.password) || '')
  if (!username || !password) return { error: '参数错误' }

  const q = throwIfError(
    await sb.from('admin_users').select('id, username, password_hash').eq('username', username).single(),
  )
  const u = q.data
  const okPwd = await bcrypt.compare(password, u.password_hash)
  if (!okPwd) return { error: '账号或密码错误' }

  const token = signAdminToken({ sub: u.id, username: u.username })
  return { token }
}

function toWorkRow(work) {
  return {
    id: work.id || undefined,
    category: work.category,
    title: work.title,
    cover_url: work.coverUrl || '',
    image_urls: Array.isArray(work.imageUrls) ? work.imageUrls : [],
    description: work.description || null,
    is_published: !!work.isPublished,
    like_count: Number(work.likeCount || 0),
    updated_at: nowIso(),
  }
}

function toPackageRow(pkg) {
  return {
    id: pkg.id || undefined,
    category: pkg.category,
    title: pkg.title,
    cover_url: pkg.coverUrl || '',
    media_urls: Array.isArray(pkg.mediaUrls) ? pkg.mediaUrls : [],
    base_price: Number(pkg.basePrice || 0),
    description: pkg.description || null,
    deliverables: pkg.deliverables || null,
    option_groups: Array.isArray(pkg.optionGroups) ? pkg.optionGroups : [],
    is_published: !!pkg.isPublished,
    like_count: Number(pkg.likeCount || 0),
    updated_at: nowIso(),
  }
}

function fromWorkRow(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    coverUrl: r.cover_url || '',
    imageUrls: r.image_urls || [],
    description: r.description || '',
    isPublished: !!r.is_published,
    likeCount: Number(r.like_count || 0),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
  }
}

function fromPackageRow(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    coverUrl: r.cover_url || '',
    mediaUrls: r.media_urls || [],
    basePrice: Number(r.base_price || 0),
    description: r.description || '',
    deliverables: r.deliverables || '',
    optionGroups: r.option_groups || [],
    isPublished: !!r.is_published,
    likeCount: Number(r.like_count || 0),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : undefined,
  }
}

async function handleAdminAction(sb, action, data, token) {
  requireAdmin(token)

  if (action === 'listWorks') {
    const r = throwIfError(await sb.from('works').select('*').order('created_at', { ascending: false }))
    return { items: (r.data || []).map(fromWorkRow) }
  }
  if (action === 'upsertWork') {
    const row = toWorkRow(data || {})
    if (row.id) {
      const u = throwIfError(await sb.from('works').update(row).eq('id', row.id).select('*').single())
      return { item: fromWorkRow(u.data) }
    }
    delete row.id
    const ins = throwIfError(await sb.from('works').insert(row).select('*').single())
    return { item: fromWorkRow(ins.data) }
  }
  if (action === 'deleteWork') {
    const id = String((data && data.id) || '')
    if (!id) return { error: '参数错误' }
    throwIfError(await sb.from('works').delete().eq('id', id))
    return { ok: true }
  }

  if (action === 'listPackages') {
    const r = throwIfError(await sb.from('packages').select('*').order('created_at', { ascending: false }))
    return { items: (r.data || []).map(fromPackageRow) }
  }
  if (action === 'upsertPackage') {
    const row = toPackageRow(data || {})
    if (row.id) {
      const u = throwIfError(await sb.from('packages').update(row).eq('id', row.id).select('*').single())
      return { item: fromPackageRow(u.data) }
    }
    delete row.id
    const ins = throwIfError(await sb.from('packages').insert(row).select('*').single())
    return { item: fromPackageRow(ins.data) }
  }
  if (action === 'deletePackage') {
    const id = String((data && data.id) || '')
    if (!id) return { error: '参数错误' }
    throwIfError(await sb.from('packages').delete().eq('id', id))
    return { ok: true }
  }

  if (action === 'getContactConfig') {
    const r = throwIfError(await sb.from('app_config').select('value').eq('key', 'contact').single())
    return r.data.value || { wechatText: '', wechatQrUrl: '' }
  }
  if (action === 'updateContactConfig') {
    const wechatText = String((data && data.wechatText) || '')
    const wechatQrUrl = String((data && data.wechatQrUrl) || '')
    const up = throwIfError(
      await sb
        .from('app_config')
        .upsert({ key: 'contact', value: { wechatText, wechatQrUrl }, updated_at: nowIso() })
        .select('value')
        .single(),
    )
    return up.data.value
  }

  return { error: 'Unknown action' }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res)

  const body = await readJsonBody(req)
  if (!body || typeof body.action !== 'string') return ok(res, { error: '参数错误' })
  const action = body.action
  const data = body.data
  const token = String(body.token || '')

  const sb = getSupabaseAdmin()

  try {
    if (action === 'setup') return ok(res, await handleSetup(sb, data))
    if (action === 'login') return ok(res, await handleLogin(sb, data))
    return ok(res, await handleAdminAction(sb, action, data, token))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    if (msg === 'Unauthorized') return ok(res, { error: 'Unauthorized' })
    return err(res, msg)
  }
}
