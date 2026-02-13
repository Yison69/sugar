const { createClient } = require('@supabase/supabase-js')
const { required } = require('./env.cjs')

let cached = null

const decodeJwtPayloadUnsafe = (token) => {
  try {
    const parts = String(token || '').split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

const getSupabaseAdmin = () => {
  if (cached) return cached
  const url = required('SUPABASE_URL')
  const key = required('SUPABASE_SERVICE_ROLE_KEY')
  const payload = decodeJwtPayloadUnsafe(key)
  const role = payload && payload.role
  if (role && role !== 'service_role') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 填错了：需要 service_role key，不能用 anon key')
  }
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

const throwIfError = (r) => {
  if (!r) throw new Error('Unknown error')
  if (r.error) throw new Error(r.error.message || 'Supabase error')
  return r
}

module.exports = {
  getSupabaseAdmin,
  throwIfError,
}
