import { useEffect, useState } from 'react'
import { getRuntimeConfig } from '@/lib/runtimeConfig'

export function useRuntimeConfig() {
  const [cfg, setCfg] = useState<{
    adminMode?: 'local' | 'cloud'
    basePath?: string
    adminApiHttpBase?: string
    cloudbaseEnvId?: string
    cloudbaseClientId?: string
  } | null>(null)

  useEffect(() => {
    let mounted = true
    getRuntimeConfig().then((c) => {
      if (!mounted) return
      setCfg(c)
    })
    return () => {
      mounted = false
    }
  }, [])

  return cfg
}
