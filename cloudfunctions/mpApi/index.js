const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const https = require('https')

const requiredEnv = (name) => {
  const v = (process.env[name] || '').trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

const getSbConfig = () => {
  const url = requiredEnv('SUPABASE_URL')
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  return { url, key }
}

const requestSb = (method, pathWithQuery, body) => {
  const { url: baseUrl, key } = getSbConfig()
  const u = new URL(baseUrl)
  const basePath = u.pathname && u.pathname !== '/' ? u.pathname.replace(/\/+$/, '') : ''
  const fullPath = `${basePath}${pathWithQuery}`

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json'
  }
  let payload = null
  if (body !== undefined) {
    payload = Buffer.from(JSON.stringify(body), 'utf8')
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(payload.length)
    headers.Prefer = 'return=representation'
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        method,
        path: fullPath,
        headers,
        timeout: 8000
      },
      (res) => {
        const chunks = []
        res.on('data', (d) => chunks.push(d))
        res.on('end', () => {
          const txt = Buffer.concat(chunks).toString('utf8')
          const code = res.statusCode || 0
          if (!txt) {
            if (code >= 200 && code < 300) return resolve(null)
            return reject(new Error(`Supabase 请求失败(${code})`))
          }
          let json
          try {
            json = JSON.parse(txt)
          } catch {
            if (code >= 200 && code < 300) return resolve(txt)
            return reject(new Error(`Supabase 请求失败(${code})`))
          }
          if (code >= 200 && code < 300) return resolve(json)
          const msg = (json && (json.message || json.error_description || json.error)) || `Supabase 请求失败(${code})`
          return reject(new Error(msg))
        })
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error('Supabase 请求超时'))
    })
    req.on('error', (e) => reject(e))
    if (payload) req.write(payload)
    req.end()
  })
}

const qs = (params) => {
  const parts = []
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

const ok = (data) => data

const nowIso = () => new Date().toISOString()

const getOpenid = () => {
  const ctx = cloud.getWXContext()
  return ctx.OPENID
}

async function listItems({ category, type }) {
  const openid = getOpenid()

  const [worksData, pkgsData] = await Promise.all([
    type === 'package'
      ? Promise.resolve([])
      : requestSb(
          'GET',
          `/rest/v1/works${qs({
            select: 'id,title,category,cover_url,like_count,created_at',
            category: `eq.${category}`,
            is_published: 'eq.true',
            order: 'created_at.desc',
            limit: 50
          })}`,
        ),
    type === 'work'
      ? Promise.resolve([])
      : requestSb(
          'GET',
          `/rest/v1/packages${qs({
            select: 'id,title,category,cover_url,base_price,like_count,created_at',
            category: `eq.${category}`,
            is_published: 'eq.true',
            order: 'created_at.desc',
            limit: 50
          })}`,
        )
  ])

  const works = (worksData || []).map((d) => ({
    id: d.id,
    type: 'work',
    title: d.title,
    category: d.category,
    coverUrl: d.cover_url || '',
    likeCount: Number(d.like_count || 0)
  }))
  const pkgs = (pkgsData || []).map((d) => ({
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

  const inList = `in.(${ids.join(',')})`
  let likes = []
  try {
    likes =
      (await requestSb(
        'GET',
        `/rest/v1/likes${qs({
          select: 'target_type,target_id',
          user_id: `eq.${openid}`,
          target_id: inList,
          limit: 200
        })}`,
      )) || []
  } catch {
    likes = []
  }
  const likedSet = new Set((likes || []).map((l) => `${l.target_type}:${l.target_id}`))
  return ok({ items: items.map((x) => ({ ...x, isLiked: likedSet.has(`${x.type}:${x.id}`) })) })
}

async function getItemDetail({ id, type }) {
  const openid = getOpenid()
  const table = type === 'package' ? 'packages' : 'works'
  const list =
    (await requestSb(
      'GET',
      `/rest/v1/${table}${qs({
        select: '*',
        id: `eq.${id}`,
        is_published: 'eq.true',
        limit: 1
      })}`,
    )) || []
  const d = list[0]
  if (!d) return ok({ item: null })

  let isLiked = false
  if (openid) {
    try {
      const likeList =
        (await requestSb(
          'GET',
          `/rest/v1/likes${qs({
            select: 'id',
            user_id: `eq.${openid}`,
            target_type: `eq.${type}`,
            target_id: `eq.${id}`,
            limit: 1
          })}`,
        )) || []
      isLiked = likeList.length > 0
    } catch {
      isLiked = false
    }
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

  const found =
    (await requestSb(
      'GET',
      `/rest/v1/likes${qs({
        select: 'id',
        user_id: `eq.${openid}`,
        target_type: `eq.${targetType}`,
        target_id: `eq.${targetId}`,
        limit: 1
      })}`,
    )) || []
  const exists = found[0]

  const table = targetType === 'package' ? 'packages' : 'works'
  if (exists) {
    await requestSb('DELETE', `/rest/v1/likes${qs({ id: `eq.${exists.id}` })}`)
    const currentList =
      (await requestSb(
        'GET',
        `/rest/v1/${table}${qs({ select: 'like_count', id: `eq.${targetId}`, limit: 1 })}`,
      )) || []
    const curr = currentList[0]
    const next = Math.max(0, Number((curr && curr.like_count) || 0) - 1)
    await requestSb('PATCH', `/rest/v1/${table}${qs({ id: `eq.${targetId}` })}`, { like_count: next, updated_at: nowIso() })
    return ok({ liked: false, likeCount: next })
  }

  await requestSb('POST', `/rest/v1/likes`, { user_id: openid, target_type: targetType, target_id: targetId })
  const currentList =
    (await requestSb(
      'GET',
      `/rest/v1/${table}${qs({ select: 'like_count', id: `eq.${targetId}`, limit: 1 })}`,
    )) || []
  const curr = currentList[0]
  const next = Math.max(0, Number((curr && curr.like_count) || 0) + 1)
  await requestSb('PATCH', `/rest/v1/${table}${qs({ id: `eq.${targetId}` })}`, { like_count: next, updated_at: nowIso() })
  return ok({ liked: true, likeCount: next })
}

async function getContactConfig() {
  const list =
    (await requestSb('GET', `/rest/v1/app_config${qs({ select: 'value', key: 'eq.contact', limit: 1 })}`)) || []
  const v = (list[0] && list[0].value) || {}
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
  if (action === 'getContactConfig') return getContactConfig()

  throw new Error('Unknown action')
}
