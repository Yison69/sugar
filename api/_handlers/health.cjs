const { sendJson, methodNotAllowed } = require('../_lib/http.cjs')
const { getSupabaseAdmin } = require('../_lib/supabase.cjs')

const ok = (res, body) =>
  sendJson(res, 200, body, {
    'cache-control': 'no-store',
  })

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res)

  try {
    const sb = getSupabaseAdmin()
    const r = await sb.from('app_config').select('key').limit(1)
    if (r.error) return ok(res, { ok: false, error: r.error.message || 'Supabase error', ts: Date.now() })
    return ok(res, { ok: true, ts: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return ok(res, { ok: false, error: msg, ts: Date.now() })
  }
}

