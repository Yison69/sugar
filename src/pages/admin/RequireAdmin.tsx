import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '@/stores/adminAuth'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const token = useAdminAuth((s) => s.token)
  const loc = useLocation()

  if (!token) {
    const next = encodeURIComponent(loc.pathname + loc.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return children
}

