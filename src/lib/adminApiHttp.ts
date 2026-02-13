import type { Booking, BookingStatus, Package, Work } from '../../shared/types'

type AdminLoginResponse = { token: string }
type ContactConfig = { wechatText: string; wechatQrUrl: string }

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${b}${p}`
}

async function readJsonSafe(res: Response) {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function toErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) return String((err as any).message)
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

async function request<T>(base: string, path: string, payload: any): Promise<T> {
  const url = joinUrl(base, path)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
      body: JSON.stringify(payload ?? {}),
    })
  } catch (e) {
    const msg = toErrorMessage(e)
    const hint =
      msg === 'Failed to fetch'
        ? '（更稳的做法是：HTTP 接口只用 POST + text/plain，避免触发预检；若仍失败，再检查 HTTP 访问服务的跨域校验/允许来源）'
        : ''
    throw new Error(`网络请求失败：${msg}${hint}。请求地址：${url}`)
  }

  const json = await readJsonSafe(res)
  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `${res.status} ${res.statusText}`
    throw new Error(String(msg))
  }
  if (json && json.error) throw new Error(String(json.error))
  return json as T
}

export function createAdminApiHttp(base: string) {
  return {
    call: (action: string, data: any, token?: string) =>
      request<any>(base, '/api/admin/rpc', {
        action,
        data,
        token: token || '',
      }),

    login: (username: string, password: string) =>
      request<AdminLoginResponse>(base, '/api/admin/rpc', { action: 'login', data: { username, password }, token: '' }),

    setup: (setupKey: string, username: string, password: string) =>
      request<{ ok: true; id: string }>(base, '/api/admin/rpc', {
        action: 'setup',
        data: { setupKey, username, password },
        token: '',
      }),

    listWorks: (token: string) => request<{ items: Work[] }>(base, '/api/admin/rpc', { action: 'listWorks', data: {}, token }),
    upsertWork: (token: string, work: any) => request<{ item: Work }>(base, '/api/admin/rpc', { action: 'upsertWork', data: work, token }),
    deleteWork: (token: string, id: string) => request<{ ok: true }>(base, '/api/admin/rpc', { action: 'deleteWork', data: { id }, token }),

    listPackages: (token: string) => request<{ items: Package[] }>(base, '/api/admin/rpc', { action: 'listPackages', data: {}, token }),
    upsertPackage: (token: string, pkg: any) => request<{ item: Package }>(base, '/api/admin/rpc', { action: 'upsertPackage', data: pkg, token }),
    deletePackage: (token: string, id: string) => request<{ ok: true }>(base, '/api/admin/rpc', { action: 'deletePackage', data: { id }, token }),

    listBookings: (token: string) => request<{ items: Booking[] }>(base, '/api/admin/rpc', { action: 'listBookings', data: {}, token }),
    updateBookingStatus: (token: string, id: string, status: BookingStatus, adminNote?: string) =>
      request<{ item: Booking }>(base, '/api/admin/rpc', { action: 'updateBookingStatus', data: { id, status, adminNote }, token }),

    getContactConfig: (token: string) => request<ContactConfig>(base, '/api/admin/rpc', { action: 'getContactConfig', data: {}, token }),
    updateContactConfig: (token: string, cfg: ContactConfig) =>
      request<ContactConfig>(base, '/api/admin/rpc', { action: 'updateContactConfig', data: cfg, token }),
  }
}

export async function diagnoseHttpApi(base: string) {
  try {
    const res = await fetch(joinUrl(base, '/api/admin/rpc'), { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })
    const text = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, body: text.slice(0, 200) }
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) }
  }
}

export async function diagnoseHttpSetup(base: string) {
  const url = joinUrl(base, '/api/admin/rpc')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
      body: JSON.stringify({ action: 'setup', data: { setupKey: 'diagnose', username: 'diagnose', password: 'diagnose' }, token: '' }),
    })
    const text = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, statusText: res.statusText, body: text.slice(0, 500) }
  } catch (e) {
    return { ok: false, error: toErrorMessage(e), url }
  }
}
