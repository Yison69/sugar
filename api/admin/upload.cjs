const { readJsonBody, sendJson, methodNotAllowed } = require('../_lib/http.cjs')
const { getSupabaseAdmin } = require('../_lib/supabase.cjs')
const { verifyAdminToken } = require('../_lib/auth.cjs')

const ok = (res, data) => sendJson(res, 200, data)

const safeFileName = (name) => {
  const base = String(name || '').trim() || 'file'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return cleaned.slice(0, 120)
}

const rand = () => Math.random().toString(36).slice(2, 10)

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res)
  const body = await readJsonBody(req)
  const token = String((body && body.token) || '')
  try {
    verifyAdminToken(token)
  } catch {
    return ok(res, { error: 'Unauthorized' })
  }

  const prefix = String((body && body.prefix) || 'uploads').trim().replace(/^\/+/, '').replace(/\/+$/, '')
  const fileName = safeFileName(body && body.fileName)
  const contentBase64 = String((body && body.contentBase64) || '')
  if (!prefix || !fileName || !contentBase64) return ok(res, { error: '参数错误' })

  let buf
  try {
    buf = Buffer.from(contentBase64, 'base64')
  } catch {
    return ok(res, { error: '参数错误' })
  }
  if (!buf || !buf.length) return ok(res, { error: '参数错误' })
  if (buf.length > 8 * 1024 * 1024) return ok(res, { error: '文件过大（建议≤8MB）' })

  const sb = getSupabaseAdmin()
  const objectPath = `${prefix}/${Date.now()}_${rand()}_${fileName}`
  const up = await sb.storage.from('media').upload(objectPath, buf, { upsert: false, contentType: 'application/octet-stream' })
  if (up.error) return ok(res, { error: up.error.message || '上传失败' })
  const pub = sb.storage.from('media').getPublicUrl(objectPath)
  const url = (pub && pub.data && pub.data.publicUrl) || ''
  return ok(res, { fileID: url, cloudPath: objectPath })
}

