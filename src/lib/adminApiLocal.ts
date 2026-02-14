import type { Package, Work } from '../../shared/types'
function nanoid(size = 12) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < size; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export type AdminLoginResponse = { token: string }
export type ContactConfig = { wechatText: string; wechatQrUrl: string }

export type LocalState = {
  adminUser?: { username: string; password: string }
  contact?: ContactConfig
  works: Work[]
  packages: Package[]
}

const STORAGE_KEY = 'photographer_admin_local_v1'

const now = () => Date.now()

function readState(): LocalState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { works: [], packages: [] }
  try {
    const parsed = JSON.parse(raw) as Partial<LocalState>
    return {
      adminUser: parsed.adminUser,
      contact: parsed.contact,
      works: parsed.works ?? [],
      packages: parsed.packages ?? [],
    }
  } catch {
    return { works: [], packages: [] }
  }
}

function writeState(next: LocalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

function requireAuthed(token: string | null | undefined) {
  if (!token) throw new Error('Unauthorized')
}

export const adminApiLocal = {
  setup: async (setupKey: string, username: string, password: string) => {
    const s = readState()
    const expected = (import.meta.env.VITE_LOCAL_SETUP_KEY as string | undefined) ?? ''
    if (!expected || setupKey !== expected) throw new Error('Forbidden')
    if (s.adminUser) throw new Error('管理员已存在')
    writeState({ ...s, adminUser: { username, password } })
    return { ok: true as const, id: nanoid() }
  },

  login: async (username: string, password: string): Promise<AdminLoginResponse> => {
    const s = readState()
    if (!s.adminUser) throw new Error('请先初始化管理员（/setup）')
    if (s.adminUser.username !== username || s.adminUser.password !== password) throw new Error('账号或密码错误')
    return { token: `local_${nanoid()}` }
  },

  exportAll: async (token: string) => {
    requireAuthed(token)
    const s = readState()
    return s
  },

  importAll: async (token: string, payload: Partial<LocalState>) => {
    requireAuthed(token)
    const s = readState()
    writeState({
      adminUser: s.adminUser,
      contact: payload.contact ?? s.contact,
      works: payload.works ?? s.works,
      packages: payload.packages ?? s.packages,
    })
    return { ok: true as const }
  },

  listWorks: async (token: string) => {
    requireAuthed(token)
    return { items: readState().works.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) }
  },

  upsertWork: async (token: string, work: Partial<Work> & Pick<Work, 'title' | 'category' | 'coverUrl' | 'imageUrls'>) => {
    requireAuthed(token)
    const s = readState()
    if (work.id) {
      const idx = s.works.findIndex((w) => w.id === work.id)
      if (idx < 0) throw new Error('Not found')
      const next: Work = { ...s.works[idx], ...work, updatedAt: now() } as Work
      const works = s.works.slice()
      works[idx] = next
      writeState({ ...s, works })
      return { item: next }
    }
    const item: Work = {
      id: nanoid(),
      title: work.title,
      category: work.category,
      coverUrl: work.coverUrl,
      imageUrls: work.imageUrls,
      description: work.description ?? '',
      isPublished: work.isPublished ?? true,
      likeCount: 0,
      createdAt: now(),
      updatedAt: now(),
    }
    writeState({ ...s, works: [item, ...s.works] })
    return { item }
  },

  deleteWork: async (token: string, id: string) => {
    requireAuthed(token)
    const s = readState()
    writeState({ ...s, works: s.works.filter((w) => w.id !== id) })
    return { ok: true as const }
  },

  listPackages: async (token: string) => {
    requireAuthed(token)
    return { items: readState().packages.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) }
  },

  upsertPackage: async (
    token: string,
    pkg: Partial<Package> & Pick<Package, 'title' | 'category' | 'coverUrl' | 'basePrice' | 'optionGroups'>,
  ) => {
    requireAuthed(token)
    const s = readState()
    if (pkg.id) {
      const idx = s.packages.findIndex((p) => p.id === pkg.id)
      if (idx < 0) throw new Error('Not found')
      const next: Package = { ...s.packages[idx], ...pkg, updatedAt: now() } as Package
      const packages = s.packages.slice()
      packages[idx] = next
      writeState({ ...s, packages })
      return { item: next }
    }
    const item: Package = {
      id: nanoid(),
      title: pkg.title,
      category: pkg.category,
      coverUrl: pkg.coverUrl,
      basePrice: pkg.basePrice,
      description: pkg.description ?? '',
      deliverables: pkg.deliverables ?? '',
      includedGroups: pkg.includedGroups ?? [],
      optionGroups: pkg.optionGroups,
      isPublished: pkg.isPublished ?? true,
      likeCount: 0,
      createdAt: now(),
      updatedAt: now(),
    }
    writeState({ ...s, packages: [item, ...s.packages] })
    return { item }
  },

  deletePackage: async (token: string, id: string) => {
    requireAuthed(token)
    const s = readState()
    writeState({ ...s, packages: s.packages.filter((p) => p.id !== id) })
    return { ok: true as const }
  },

  getContactConfig: async (token: string) => {
    requireAuthed(token)
    const s = readState()
    return { wechatText: s.contact?.wechatText ?? '', wechatQrUrl: s.contact?.wechatQrUrl ?? '' }
  },

  updateContactConfig: async (token: string, cfg: ContactConfig) => {
    requireAuthed(token)
    const s = readState()
    writeState({ ...s, contact: cfg })
    return cfg
  },
}
