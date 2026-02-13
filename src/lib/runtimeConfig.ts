type RuntimeConfig = {
  adminMode?: 'local' | 'cloud'
  basePath?: string
  adminApiHttpBase?: string
  cloudbaseEnvId?: string
  cloudbaseClientId?: string
}

let cached: RuntimeConfig | null = null
let loading: Promise<RuntimeConfig> | null = null

function coerce(v: any): RuntimeConfig {
  if (!v || typeof v !== 'object') return {}
  const adminMode = v.adminMode === 'local' || v.adminMode === 'cloud' ? v.adminMode : undefined
  const basePath = typeof v.basePath === 'string' ? v.basePath.trim() : undefined
  const adminApiHttpBase = typeof v.adminApiHttpBase === 'string' ? v.adminApiHttpBase.trim() : undefined
  const cloudbaseEnvId = typeof v.cloudbaseEnvId === 'string' ? v.cloudbaseEnvId.trim() : undefined
  const cloudbaseClientId = typeof v.cloudbaseClientId === 'string' ? v.cloudbaseClientId.trim() : undefined
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
