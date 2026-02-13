const { createClient } = require('@supabase/supabase-js')
const { required } = require('./env.cjs')

let cached = null

const getSupabaseAdmin = () => {
  if (cached) return cached
  const url = required('SUPABASE_URL')
  const key = required('SUPABASE_SERVICE_ROLE_KEY')
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

