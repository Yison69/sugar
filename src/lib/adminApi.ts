import type { Package, Work } from '../../shared/types'
import { useAdminAuth } from '@/stores/adminAuth'
import { getCloudbaseApp } from '@/lib/cloudbase'
import { adminApiLocal, type LocalState } from '@/lib/adminApiLocal'
import { getRuntimeConfig } from '@/lib/runtimeConfig'
import { createAdminApiHttp } from '@/lib/adminApiHttp'

export type AdminLoginResponse = { token: string }
export type ContactConfig = { wechatText: string; wechatQrUrl: string }
export type MiniProgramLoginConfig = { username: string; hasPassword: boolean }

type RpcResult<T> = T & { error?: string }

function toErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    return String(m)
  }
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

type AdminHttp = ReturnType<typeof createAdminApiHttp>

async function callHttp<T>(http: AdminHttp, action: string, data: unknown, token: string): Promise<RpcResult<T>> {
  try {
    if (action === 'setup') {
      const d = data as { setupKey: string; username: string; password: string }
      return (await http.setup(d.setupKey, d.username, d.password)) as unknown as RpcResult<T>
    }
    if (action === 'login') {
      const d = data as { username: string; password: string }
      return (await http.login(d.username, d.password)) as unknown as RpcResult<T>
    }
    return (await http.call(action, data, token)) as unknown as RpcResult<T>
  } catch (e) {
    return { error: toErrorMessage(e) || 'HTTP 调用失败' } as RpcResult<T>
  }
}

async function callLocal<T>(action: string, data: unknown, token: string): Promise<RpcResult<T>> {
  if (action === 'setup') {
    const d = data as { setupKey: string; username: string; password: string }
    return (await adminApiLocal.setup(d.setupKey, d.username, d.password)) as unknown as RpcResult<T>
  }
  if (action === 'login') {
    const d = data as { username: string; password: string }
    return (await adminApiLocal.login(d.username, d.password)) as unknown as RpcResult<T>
  }
  if (action === 'listWorks') return (await adminApiLocal.listWorks(token)) as unknown as RpcResult<T>
  if (action === 'upsertWork') {
    const work = data as Partial<Work> & Pick<Work, 'title' | 'category' | 'coverUrl' | 'imageUrls'>
    return (await adminApiLocal.upsertWork(token, work)) as unknown as RpcResult<T>
  }
  if (action === 'deleteWork') {
    const id = String((data as { id?: unknown }).id || '')
    return (await adminApiLocal.deleteWork(token, id)) as unknown as RpcResult<T>
  }
  if (action === 'listPackages') return (await adminApiLocal.listPackages(token)) as unknown as RpcResult<T>
  if (action === 'upsertPackage') {
    const pkg = data as Partial<Package> & Pick<Package, 'title' | 'category' | 'coverUrl' | 'basePrice' | 'optionGroups'>
    return (await adminApiLocal.upsertPackage(token, pkg)) as unknown as RpcResult<T>
  }
  if (action === 'deletePackage') {
    const id = String((data as { id?: unknown }).id || '')
    return (await adminApiLocal.deletePackage(token, id)) as unknown as RpcResult<T>
  }
  if (action === 'getContactConfig') return (await adminApiLocal.getContactConfig(token)) as unknown as RpcResult<T>
  if (action === 'updateContactConfig') {
    const cfg = data as { wechatText: string; wechatQrUrl: string }
    return (await adminApiLocal.updateContactConfig(token, cfg)) as unknown as RpcResult<T>
  }
  if (action === 'getMiniProgramLoginConfig') return (await adminApiLocal.getMiniProgramLoginConfig(token)) as unknown as RpcResult<T>
  if (action === 'updateMiniProgramLoginConfig') {
    const cfg = data as { username: string; password: string }
    return (await adminApiLocal.updateMiniProgramLoginConfig(token, cfg)) as unknown as RpcResult<T>
  }
  if (action === 'exportAll') return (await adminApiLocal.exportAll(token)) as unknown as RpcResult<T>
  if (action === 'importAll') {
    const payload = data as Partial<LocalState>
    return (await adminApiLocal.importAll(token, payload)) as unknown as RpcResult<T>
  }

  return { error: 'Unknown action' } as RpcResult<T>
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

  exportAll: () => ensureOk(callAdmin<LocalState>('exportAll')),
  importAll: (payload: Partial<LocalState>) => ensureOk(callAdmin<{ ok: true }>('importAll', payload)),

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

  getContactConfig: () => ensureOk(callAdmin<ContactConfig>('getContactConfig')),
  updateContactConfig: (cfg: ContactConfig) =>
    ensureOk(callAdmin<ContactConfig>('updateContactConfig', cfg)),
  getMiniProgramLoginConfig: () => ensureOk(callAdmin<MiniProgramLoginConfig>('getMiniProgramLoginConfig')),
  updateMiniProgramLoginConfig: (cfg: { username: string; password: string }) =>
    ensureOk(callAdmin<MiniProgramLoginConfig>('updateMiniProgramLoginConfig', cfg)),
}
