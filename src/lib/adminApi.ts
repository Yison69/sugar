import type { Booking, BookingStatus, Package, Work } from '../../shared/types'
import { useAdminAuth } from '@/stores/adminAuth'
import { getCloudbaseApp } from '@/lib/cloudbase'
import { adminApiLocal } from '@/lib/adminApiLocal'
import { getRuntimeConfig } from '@/lib/runtimeConfig'
import { createAdminApiHttp } from '@/lib/adminApiHttp'

export type AdminLoginResponse = { token: string }
export type ContactConfig = { wechatText: string; wechatQrUrl: string }

type RpcResult<T> = T & { error?: string }

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

async function callAdmin<T>(action: string, data?: unknown): Promise<RpcResult<T>> {
  const token = useAdminAuth.getState().token

  const cfg = await getRuntimeConfig()
  const mode = (cfg.adminMode || ((import.meta.env.VITE_ADMIN_MODE as string | undefined) ?? '').trim()) as string
  if (mode === 'local') {
    return callLocal<T>(action, data, token)
  }

  if (cfg.adminApiHttpBase) {
    const http = createAdminApiHttp(cfg.adminApiHttpBase)
    return callHttp<T>(http, action, data, token)
  }

  const app = await getCloudbaseApp()
  try {
    const res = await app.callFunction({
      name: 'adminApi',
      data: { action, data, token },
    })
    return (res.result ?? null) as RpcResult<T>
  } catch (e) {
    throw new Error(toErrorMessage(e) || '云函数调用失败')
  }
}

async function callHttp<T>(http: ReturnType<typeof createAdminApiHttp>, action: string, data: unknown, token: string) {
  try {
    if (action === 'setup') {
      const d = data as any
      return (await http.setup(d.setupKey, d.username, d.password)) as any
    }
    if (action === 'login') {
      const d = data as any
      return (await http.login(d.username, d.password)) as any
    }
    return (await http.call(action, data as any, token)) as any
  } catch (e) {
    return { error: toErrorMessage(e) || 'HTTP 调用失败' } as any
  }
}

async function callLocal<T>(action: string, data: unknown, token: string) {
  if (action === 'setup') {
    const d = data as any
    return (await adminApiLocal.setup(d.setupKey, d.username, d.password)) as any
  }
  if (action === 'login') {
    const d = data as any
    return (await adminApiLocal.login(d.username, d.password)) as any
  }
  if (action === 'listWorks') return (await adminApiLocal.listWorks(token)) as any
  if (action === 'upsertWork') return (await adminApiLocal.upsertWork(token, data as any)) as any
  if (action === 'deleteWork') return (await adminApiLocal.deleteWork(token, (data as any).id)) as any
  if (action === 'listPackages') return (await adminApiLocal.listPackages(token)) as any
  if (action === 'upsertPackage') return (await adminApiLocal.upsertPackage(token, data as any)) as any
  if (action === 'deletePackage') return (await adminApiLocal.deletePackage(token, (data as any).id)) as any
  if (action === 'listBookings') return (await adminApiLocal.listBookings(token)) as any
  if (action === 'updateBookingStatus') {
    const d = data as any
    return (await adminApiLocal.updateBookingStatus(token, d.id, d.status, d.adminNote)) as any
  }
  if (action === 'getContactConfig') return (await adminApiLocal.getContactConfig(token)) as any
  if (action === 'updateContactConfig') return (await adminApiLocal.updateContactConfig(token, data as any)) as any
  if (action === 'exportAll') return (await adminApiLocal.exportAll(token)) as any
  if (action === 'importAll') return (await adminApiLocal.importAll(token, data as any)) as any

  return { error: 'Unknown action' } as any
}

async function ensureOk<T>(p: Promise<RpcResult<T>>): Promise<T> {
  const r = await p
  if (!r) throw new Error('请求失败')
  if (r.error) throw new Error(r.error)
  return r as T
}

export const adminApi = {
  login: (username: string, password: string) =>
    ensureOk(callAdmin<AdminLoginResponse>('login', { username, password })),

  setup: (setupKey: string, username: string, password: string) =>
    ensureOk(callAdmin<{ ok: true; id: string }>('setup', { setupKey, username, password })),

  exportAll: () => ensureOk(callAdmin<any>('exportAll')),
  importAll: (payload: any) => ensureOk(callAdmin<{ ok: true }>('importAll', payload)),

  listWorks: () => ensureOk(callAdmin<{ items: Work[] }>('listWorks')),
  upsertWork: (work: Partial<Work> & Pick<Work, 'title' | 'category' | 'coverUrl' | 'imageUrls'>) =>
    ensureOk(callAdmin<{ item: Work }>('upsertWork', work)),
  deleteWork: (id: string) =>
    ensureOk(callAdmin<{ ok: true }>('deleteWork', { id })),

  listPackages: () => ensureOk(callAdmin<{ items: Package[] }>('listPackages')),
  upsertPackage: (
    pkg: Partial<Package> & Pick<Package, 'title' | 'category' | 'coverUrl' | 'basePrice' | 'optionGroups'>,
  ) =>
    ensureOk(callAdmin<{ item: Package }>('upsertPackage', pkg)),
  deletePackage: (id: string) =>
    ensureOk(callAdmin<{ ok: true }>('deletePackage', { id })),

  listBookings: () => ensureOk(callAdmin<{ items: Booking[] }>('listBookings')),
  updateBookingStatus: (id: string, status: BookingStatus, adminNote?: string) =>
    ensureOk(callAdmin<{ item: Booking }>('updateBookingStatus', { id, status, adminNote })),

  getContactConfig: () => ensureOk(callAdmin<ContactConfig>('getContactConfig')),
  updateContactConfig: (cfg: ContactConfig) =>
    ensureOk(callAdmin<ContactConfig>('updateContactConfig', cfg)),
}
