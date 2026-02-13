type RuntimeConfig = {
  adminMode?: 'local' | 'cloud'
  basePath?: string
  adminApiHttpBase?: string
  cloudbaseEnvId?: string
  cloudbaseClientId?: string
}

let cached: RuntimeConfig | null = null
let loading: Promise<RuntimeConfig> | null = null

function coerce(v: unknown): RuntimeConfig {
  if (!v || typeof v !== 'object') return {}
  const o = v as Record<string, unknown>
  const adminMode = o.adminMode === 'local' || o.adminMode === 'cloud' ? o.adminMode : undefined
  const basePath = typeof o.basePath === 'string' ? o.basePath.trim() : undefined
  const adminApiHttpBase = typeof o.adminApiHttpBase === 'string' ? o.adminApiHttpBase.trim() : undefined
  const cloudbaseEnvId = typeof o.cloudbaseEnvId === 'string' ? o.cloudbaseEnvId.trim() : undefined
  const cloudbaseClientId = typeof o.cloudbaseClientId === 'string' ? o.cloudbaseClientId.trim() : undefined
  return {
    adminMode,
    basePath: basePath || undefined,
    adminApiHttpBase: adminApiHttpBase || undefined,
    cloudbaseEnvId: cloudbaseEnvId || undefined,
    cloudbaseClientId: cloudbaseClientId || undefined,
  }
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached
  if (loading) return loading

  loading = (async () => {
    try {
      const res = await fetch(`/runtime-config.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        cached = {}
        return cached
      }
      const json = await res.json().catch(() => null)
      cached = coerce(json)
      return cached
    } catch {
      cached = {}
      return cached
    } finally {
      loading = null
    }
  })()

  return loading
}
