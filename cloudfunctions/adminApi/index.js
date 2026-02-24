const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const json = (statusCode, body, extraHeaders) => {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization, x-setup-key',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...extraHeaders
  }
  return {
    statusCode,
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }
}

const now = () => Date.now()

const readBodyJson = (event) => {
  if (!event.body) return null
  try {
    if (typeof event.body === 'string') {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
      return JSON.parse(raw)
    }
    return event.body
  } catch {
    return null
  }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const MP_LOGIN_DOC_ID = 'miniProgramLogin'
const hashMpPassword = (password) => `sha256$${sha256(`mp-login:${password}`)}`

const randomToken = () => crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const normalizeKey = (s) => String(s || '').replace(/[\s\u200B\uFEFF]+/g, '').trim()

const safeFileName = (name) => {
  const base = String(name || '').trim() || 'file'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return cleaned.slice(0, 80)
}

const rand = () => Math.random().toString(36).slice(2, 10)

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16)
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

const verifyPassword = async (password, hash) => {
  const parts = String(hash || '').split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'hex')
  const stored = Buffer.from(parts[2], 'hex')
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, stored.length, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
  return crypto.timingSafeEqual(stored, derived)
}

async function requireAdmin(event) {
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  let t = token
  if (!t) {
    const q = event.queryStringParameters || event.query || {}
    if (q && typeof q.token === 'string') t = q.token
  }
  if (!t) {
    const body = readBodyJson(event)
    if (body && typeof body.token === 'string') t = body.token
  }
  if (!t) return null
  return requireAdminToken(t)
}

async function requireAdminToken(token) {
  const tokenHash = sha256(token)
  const res = await db
    .collection('admin_sessions')
    .where({ tokenHash, expiresAt: _.gt(now()) })
    .limit(1)
    .get()
  const session = (res.data || [])[0]
  if (!session) return null
  const userRes = await db.collection('admin_users').doc(session.adminUserId).get().catch(() => null)
  const user = userRes && userRes.data
  if (!user || !user.isActive) return null
  return { user, session }
}

async function handleLogin(event) {
  const body = readBodyJson(event)
  if (!body || !body.username || !body.password) return json(400, { error: '参数错误' })

  const res = await db
    .collection('admin_users')
    .where({ username: body.username, isActive: true })
    .limit(1)
    .get()
  const user = (res.data || [])[0]
  if (!user) return json(401, { error: '账号或密码错误' })

  const okPw = await verifyPassword(body.password, user.passwordHash)
  if (!okPw) return json(401, { error: '账号或密码错误' })

  const token = randomToken()
  const expiresAt = now() + 7 * 24 * 60 * 60 * 1000

  await db.collection('admin_sessions').add({
    data: {
      adminUserId: user._id,
      tokenHash: sha256(token),
      expiresAt,
      createdAt: now()
    }
  })

  return json(200, { token })
}

async function handleSetup(event) {
  const body = readBodyJson(event)
  const setupKeyHeader = (event.headers && (event.headers['x-setup-key'] || event.headers['X-Setup-Key'])) || ''
  const setupKeyBody = body && typeof body.setupKey === 'string' ? body.setupKey : ''
  const setupKeyRaw = String(setupKeyHeader || setupKeyBody || '')
  const expectedRaw = String(process.env.ADMIN_SETUP_KEY || '')
  const setupKey = normalizeKey(setupKeyRaw)
  const expected = normalizeKey(expectedRaw)
  if (!expected || setupKey !== expected) {
    if (String(process.env.ADMIN_SETUP_DEBUG || '').trim() === '1') {
      const ctx = cloud.getWXContext ? cloud.getWXContext() : {}
      return json(403, {
        error: 'Forbidden',
        debug: {
          env: ctx && (ctx.ENV || ctx.env),
          expectedPresent: !!expected,
          expectedLength: expected.length,
          receivedLength: setupKey.length,
          receivedFrom: setupKeyHeader ? 'header' : setupKeyBody ? 'body' : 'none',
        },
      })
    }
    return json(403, { error: 'Forbidden' })
  }

  if (!body || !body.username || !body.password) return json(400, { error: '参数错误' })

  const existing = await db.collection('admin_users').limit(1).get()
  if ((existing.data || []).length) return json(409, { error: '管理员已存在' })

  const passwordHash = await hashPassword(body.password)
  const res = await db.collection('admin_users').add({
    data: {
      username: body.username,
      passwordHash,
      isActive: true,
      createdAt: now()
    }
  })

  return json(200, { ok: true, id: res._id })
}

async function handleLoginRpc(payload) {
  if (!payload || !payload.username || !payload.password) return { error: '参数错误' }

  const res = await db
    .collection('admin_users')
    .where({ username: payload.username, isActive: true })
    .limit(1)
    .get()
  const user = (res.data || [])[0]
  if (!user) return { error: '账号或密码错误' }

  const okPw = await verifyPassword(payload.password, user.passwordHash)
  if (!okPw) return { error: '账号或密码错误' }

  const token = randomToken()
  const expiresAt = now() + 7 * 24 * 60 * 60 * 1000
  await db.collection('admin_sessions').add({
    data: { adminUserId: user._id, tokenHash: sha256(token), expiresAt, createdAt: now() }
  })

  return { token }
}

async function handleSetupRpc(payload) {
  const expected = process.env.ADMIN_SETUP_KEY || ''
  if (!expected || !payload || payload.setupKey !== expected) return { error: 'Forbidden' }
  if (!payload.username || !payload.password) return { error: '参数错误' }

  const existing = await db.collection('admin_users').limit(1).get()
  if ((existing.data || []).length) return { error: '管理员已存在' }

  const passwordHash = await hashPassword(payload.password)
  const res = await db.collection('admin_users').add({
    data: { username: payload.username, passwordHash, isActive: true, createdAt: now() }
  })
  return { ok: true, id: res._id }
}

async function listWorksRpc() {
  const res = await db.collection('works').orderBy('createdAt', 'desc').limit(200).get()
  return { items: (res.data || []).map(mapWork) }
}

async function upsertWorkRpc(payload) {
  if (!payload || !payload.title || !payload.category || !payload.coverUrl || !Array.isArray(payload.imageUrls)) {
    return { error: '参数错误' }
  }
  if (payload.id) {
    await db
      .collection('works')
      .doc(payload.id)
      .update({
        data: {
          title: payload.title,
          category: payload.category,
          coverUrl: payload.coverUrl,
          imageUrls: payload.imageUrls,
          description: payload.description || '',
          isPublished: !!payload.isPublished,
          updatedAt: now()
        }
      })
    const res = await db.collection('works').doc(payload.id).get()
    return { item: mapWork(res.data) }
  }
  const res = await db.collection('works').add({
    data: {
      title: payload.title,
      category: payload.category,
      coverUrl: payload.coverUrl,
      imageUrls: payload.imageUrls,
      description: payload.description || '',
      isPublished: payload.isPublished !== false,
      likeCount: 0,
      createdAt: now(),
      updatedAt: now()
    }
  })
  const doc = await db.collection('works').doc(res._id).get()
  return { item: mapWork(doc.data) }
}

async function deleteWorkRpc(payload) {
  if (!payload || !payload.id) return { error: '参数错误' }
  await db.collection('works').doc(payload.id).remove()
  return { ok: true }
}

async function listPackagesRpc() {
  const res = await db.collection('packages').orderBy('createdAt', 'desc').limit(200).get()
  return { items: (res.data || []).map(mapPackage) }
}

async function upsertPackageRpc(payload) {
  if (
    !payload ||
    !payload.title ||
    !payload.category ||
    !payload.coverUrl ||
    typeof payload.basePrice !== 'number' ||
    !Array.isArray(payload.optionGroups)
  ) {
    return { error: '参数错误' }
  }
  if (payload.id) {
    await db
      .collection('packages')
      .doc(payload.id)
      .update({
        data: {
          title: payload.title,
          category: payload.category,
          coverUrl: payload.coverUrl,
          basePrice: payload.basePrice,
          description: payload.description || '',
          deliverables: payload.deliverables || '',
          optionGroups: payload.optionGroups,
          isPublished: !!payload.isPublished,
          updatedAt: now()
        }
      })
    const res = await db.collection('packages').doc(payload.id).get()
    return { item: mapPackage(res.data) }
  }
  const res = await db.collection('packages').add({
    data: {
      title: payload.title,
      category: payload.category,
      coverUrl: payload.coverUrl,
      basePrice: payload.basePrice,
      description: payload.description || '',
      deliverables: payload.deliverables || '',
      optionGroups: payload.optionGroups,
      isPublished: payload.isPublished !== false,
      likeCount: 0,
      createdAt: now(),
      updatedAt: now()
    }
  })
  const doc = await db.collection('packages').doc(res._id).get()
  return { item: mapPackage(doc.data) }
}

async function deletePackageRpc(payload) {
  if (!payload || !payload.id) return { error: '参数错误' }
  await db.collection('packages').doc(payload.id).remove()
  return { ok: true }
}

async function listBookingsRpc() {
  const res = await db.collection('bookings').orderBy('createdAt', 'desc').limit(200).get()
  return { items: (res.data || []).map(mapBooking) }
}

async function updateBookingStatusRpc(payload) {
  if (!payload || !payload.id || !payload.status) return { error: '参数错误' }
  await db.collection('bookings').doc(payload.id).update({
    data: {
      status: payload.status,
      adminNote: payload.adminNote || '',
      updatedAt: now()
    }
  })
  const res = await db.collection('bookings').doc(payload.id).get()
  return { item: mapBooking(res.data) }
}

async function getContactConfigRpc() {
  const res = await db.collection('config').doc('contact').get().catch(() => null)
  const d = res && res.data
  return { wechatText: (d && d.wechatText) || '', wechatQrUrl: (d && d.wechatQrUrl) || '' }
}

async function updateContactConfigRpc(payload) {
  if (!payload) return { error: '参数错误' }
  await db
    .collection('config')
    .doc('contact')
    .set({ data: { wechatText: payload.wechatText || '', wechatQrUrl: payload.wechatQrUrl || '', updatedAt: now() } })
  return getContactConfigRpc()
}

async function getMiniProgramLoginConfigRpc() {
  const res = await db.collection('config').doc(MP_LOGIN_DOC_ID).get().catch(() => null)
  const d = res && res.data
  const username = (d && d.username) || ''
  const hasPassword = !!((d && d.passwordHash) || '')
  return { username, hasPassword }
}

async function updateMiniProgramLoginConfigRpc(payload) {
  if (!payload) return { error: '参数错误' }
  const username = String(payload.username || '').trim()
  const password = String(payload.password || '')
  if (!username) return { error: '账号不能为空' }

  const prevRes = await db.collection('config').doc(MP_LOGIN_DOC_ID).get().catch(() => null)
  const prev = (prevRes && prevRes.data) || {}
  const prevHash = String(prev.passwordHash || '')
  const passwordHash = password ? hashMpPassword(password) : prevHash
  if (!passwordHash) return { error: '请设置密码' }

  await db.collection('config').doc(MP_LOGIN_DOC_ID).set({
    data: {
      username,
      passwordHash,
      updatedAt: now()
    }
  })
  return getMiniProgramLoginConfigRpc()
}

async function handleRpc(event) {
  const action = event.action
  const data = event.data || {}
  const token = event.token || ''

  if (action === 'setup') return handleSetupRpc(data)
  if (action === 'login') return handleLoginRpc(data)

  const admin = token ? await requireAdminToken(token) : null
  if (!admin) return { error: 'Unauthorized' }

  if (action === 'listWorks') return listWorksRpc()
  if (action === 'upsertWork') return upsertWorkRpc(data)
  if (action === 'deleteWork') return deleteWorkRpc(data)
  if (action === 'listPackages') return listPackagesRpc()
  if (action === 'upsertPackage') return upsertPackageRpc(data)
  if (action === 'deletePackage') return deletePackageRpc(data)
  if (action === 'listBookings') return listBookingsRpc()
  if (action === 'updateBookingStatus') return updateBookingStatusRpc(data)
  if (action === 'getContactConfig') return getContactConfigRpc()
  if (action === 'updateContactConfig') return updateContactConfigRpc(data)
  if (action === 'getMiniProgramLoginConfig') return getMiniProgramLoginConfigRpc()
  if (action === 'updateMiniProgramLoginConfig') return updateMiniProgramLoginConfigRpc(data)

  return { error: 'Unknown action' }
}

const mapWork = (d) => ({
  id: d._id,
  category: d.category,
  title: d.title,
  coverUrl: d.coverUrl,
  imageUrls: d.imageUrls || [],
  description: d.description || '',
  isPublished: !!d.isPublished,
  likeCount: d.likeCount || 0,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt
})

const mapPackage = (d) => ({
  id: d._id,
  category: d.category,
  title: d.title,
  coverUrl: d.coverUrl,
  basePrice: d.basePrice || 0,
  description: d.description || '',
  deliverables: d.deliverables || '',
  optionGroups: d.optionGroups || [],
  isPublished: !!d.isPublished,
  likeCount: d.likeCount || 0,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt
})

const mapBooking = (d) => ({
  id: d._id,
  userOpenid: d.userOpenid,
  itemType: d.itemType,
  itemId: d.itemId,
  itemTitleSnapshot: d.itemTitleSnapshot,
  selectedOptionsSnapshot: d.selectedOptionsSnapshot || null,
  priceSnapshot: d.priceSnapshot || null,
  contactName: d.contactName,
  contactPhone: d.contactPhone,
  contactWechat: d.contactWechat,
  shootingType: d.shootingType,
  scheduledAt: d.scheduledAt,
  remark: d.remark || '',
  status: d.status,
  adminNote: d.adminNote || '',
  createdAt: d.createdAt,
  updatedAt: d.updatedAt
})

async function handleWorks(event) {
  const method = event.httpMethod
  if (method === 'GET') {
    const res = await db.collection('works').orderBy('createdAt', 'desc').limit(200).get()
    return json(200, { items: (res.data || []).map(mapWork) })
  }
  if (method === 'POST') {
    const body = readBodyJson(event)
    if (!body || !body.title || !body.category || !body.coverUrl || !Array.isArray(body.imageUrls)) {
      return json(400, { error: '参数错误' })
    }
    if (body.id) {
      await db
        .collection('works')
        .doc(body.id)
        .update({
          data: {
            title: body.title,
            category: body.category,
            coverUrl: body.coverUrl,
            imageUrls: body.imageUrls,
            description: body.description || '',
            isPublished: !!body.isPublished,
            updatedAt: now()
          }
        })
      const res = await db.collection('works').doc(body.id).get()
      return json(200, { item: mapWork(res.data) })
    }
    const res = await db.collection('works').add({
      data: {
        title: body.title,
        category: body.category,
        coverUrl: body.coverUrl,
        imageUrls: body.imageUrls,
        description: body.description || '',
        isPublished: body.isPublished !== false,
        likeCount: 0,
        createdAt: now(),
        updatedAt: now()
      }
    })
    const doc = await db.collection('works').doc(res._id).get()
    return json(200, { item: mapWork(doc.data) })
  }
  return json(405, { error: 'Method not allowed' })
}

async function handleWorkById(event, id) {
  const method = event.httpMethod
  if (method === 'DELETE') {
    await db.collection('works').doc(id).remove()
    return json(200, { ok: true })
  }
  return json(405, { error: 'Method not allowed' })
}

async function handlePackages(event) {
  const method = event.httpMethod
  if (method === 'GET') {
    const res = await db.collection('packages').orderBy('createdAt', 'desc').limit(200).get()
    return json(200, { items: (res.data || []).map(mapPackage) })
  }
  if (method === 'POST') {
    const body = readBodyJson(event)
    if (!body || !body.title || !body.category || !body.coverUrl || typeof body.basePrice !== 'number' || !Array.isArray(body.optionGroups)) {
      return json(400, { error: '参数错误' })
    }
    if (body.id) {
      await db
        .collection('packages')
        .doc(body.id)
        .update({
          data: {
            title: body.title,
            category: body.category,
            coverUrl: body.coverUrl,
            basePrice: body.basePrice,
            description: body.description || '',
            deliverables: body.deliverables || '',
            optionGroups: body.optionGroups,
            isPublished: !!body.isPublished,
            updatedAt: now()
          }
        })
      const res = await db.collection('packages').doc(body.id).get()
      return json(200, { item: mapPackage(res.data) })
    }
    const res = await db.collection('packages').add({
      data: {
        title: body.title,
        category: body.category,
        coverUrl: body.coverUrl,
        basePrice: body.basePrice,
        description: body.description || '',
        deliverables: body.deliverables || '',
        optionGroups: body.optionGroups,
        isPublished: body.isPublished !== false,
        likeCount: 0,
        createdAt: now(),
        updatedAt: now()
      }
    })
    const doc = await db.collection('packages').doc(res._id).get()
    return json(200, { item: mapPackage(doc.data) })
  }
  return json(405, { error: 'Method not allowed' })
}

async function handlePackageById(event, id) {
  const method = event.httpMethod
  if (method === 'DELETE') {
    await db.collection('packages').doc(id).remove()
    return json(200, { ok: true })
  }
  return json(405, { error: 'Method not allowed' })
}

async function handleBookings(event) {
  const method = event.httpMethod
  if (method === 'GET') {
    const res = await db.collection('bookings').orderBy('createdAt', 'desc').limit(200).get()
    return json(200, { items: (res.data || []).map(mapBooking) })
  }
  return json(405, { error: 'Method not allowed' })
}

async function handleBookingStatus(event, id) {
  const method = event.httpMethod
  if (method !== 'PUT') return json(405, { error: 'Method not allowed' })
  const body = readBodyJson(event)
  if (!body || !body.status) return json(400, { error: '参数错误' })
  await db.collection('bookings').doc(id).update({
    data: {
      status: body.status,
      adminNote: body.adminNote || '',
      updatedAt: now()
    }
  })
  const res = await db.collection('bookings').doc(id).get()
  return json(200, { item: mapBooking(res.data) })
}

async function handleContactConfig(event) {
  const method = event.httpMethod
  if (method === 'GET') {
    const res = await db.collection('config').doc('contact').get().catch(() => null)
    const d = res && res.data
    return json(200, { wechatText: (d && d.wechatText) || '', wechatQrUrl: (d && d.wechatQrUrl) || '' })
  }
  if (method === 'PUT') {
    const body = readBodyJson(event)
    if (!body) return json(400, { error: '参数错误' })
    await db
      .collection('config')
      .doc('contact')
      .set({
        data: {
          wechatText: body.wechatText || '',
          wechatQrUrl: body.wechatQrUrl || '',
          updatedAt: now()
        }
      })
    const res = await db.collection('config').doc('contact').get().catch(() => null)
    const d = res && res.data
    return json(200, { wechatText: (d && d.wechatText) || '', wechatQrUrl: (d && d.wechatQrUrl) || '' })
  }
  return json(405, { error: 'Method not allowed' })
}

async function handleUpload(event) {
  const admin = await requireAdmin(event)
  if (!admin) return json(401, { error: 'Unauthorized' })

  const body = readBodyJson(event)
  if (!body || !body.contentBase64 || !body.prefix) return json(400, { error: '参数错误' })

  const prefix = String(body.prefix || '').trim().replace(/^\/+/, '').replace(/\/+$/, '')
  if (!prefix) return json(400, { error: '参数错误' })

  const fileName = safeFileName(body.fileName || body.filename || 'file')
  const cloudPath = `${prefix}/${Date.now()}_${rand()}_${fileName}`

  let buf
  try {
    buf = Buffer.from(String(body.contentBase64), 'base64')
  } catch {
    return json(400, { error: '参数错误' })
  }
  if (!buf || !buf.length) return json(400, { error: '参数错误' })
  if (buf.length > 8 * 1024 * 1024) return json(413, { error: '文件过大（建议≤8MB）' })

  const res = await cloud.uploadFile({ cloudPath, fileContent: buf })
  return json(200, { fileID: res.fileID, cloudPath })
}

async function handleRpcHttp(event) {
  const body = readBodyJson(event)
  const action = body && typeof body.action === 'string' ? body.action : ''
  const data = body && typeof body.data === 'object' ? body.data : {}
  const token = body && typeof body.token === 'string' ? body.token : ''
  const result = await handleRpc({ action, data, token })
  return json(200, result)
}

exports.main = async (event) => {
  if (!event || !event.httpMethod) {
    try {
      return await handleRpc(event || {})
    } catch (e) {
      return { error: e instanceof Error ? e.message : '内部错误' }
    }
  }
  if (event.httpMethod === 'OPTIONS') return json(204, '')

  const rawPath = event.path || event.rawPath || ''
  let path = rawPath
  const idxApi = rawPath.indexOf('/api/')
  if (idxApi >= 0) {
    path = rawPath.slice(idxApi)
  } else {
    const idxAdmin = rawPath.indexOf('/admin/')
    if (idxAdmin >= 0) {
      path = `/api${rawPath.slice(idxAdmin)}`
    }
  }

  if (path === '/api/admin/setup' && event.httpMethod === 'POST') {
    return handleSetup(event)
  }

  if (path === '/api/admin/login' && event.httpMethod === 'POST') {
    return handleLogin(event)
  }

  if (path === '/api/admin/rpc' && event.httpMethod === 'POST') {
    return handleRpcHttp(event)
  }

  const admin = await requireAdmin(event)
  if (!admin) return json(401, { error: 'Unauthorized' })

  if (path === '/api/admin/works') return handleWorks(event)
  if (path.startsWith('/api/admin/works/') && path.split('/').length === 5) {
    const id = decodeURIComponent(path.split('/')[4])
    return handleWorkById(event, id)
  }
  if (path === '/api/admin/packages') return handlePackages(event)
  if (path.startsWith('/api/admin/packages/') && path.split('/').length === 5) {
    const id = decodeURIComponent(path.split('/')[4])
    return handlePackageById(event, id)
  }
  if (path === '/api/admin/config/contact') return handleContactConfig(event)

  if (path === '/api/admin/upload' && event.httpMethod === 'POST') {
    return handleUpload(event)
  }

  return json(404, { error: 'Not found' })
}
