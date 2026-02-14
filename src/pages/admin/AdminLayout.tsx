import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Camera, Package as PackageIcon, LogOut, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminAuth } from '@/stores/adminAuth'

const nav = [
  { to: '/admin/works', label: '作品', icon: Camera },
  { to: '/admin/packages', label: '套餐', icon: PackageIcon },
  { to: '/admin/settings', label: '设置', icon: Settings },
]

export default function AdminLayout() {
  const loc = useLocation()
  const navigate = useNavigate()
  const logout = useAdminAuth((s) => s.logout)

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border border-zinc-200 bg-white p-3 lg:sticky lg:top-6 lg:h-[calc(100vh-48px)]">
          <div className="px-2 py-2 text-sm font-semibold text-zinc-900">摄影管理端</div>
          <nav className="mt-2 space-y-1">
            {nav.map((n) => {
              const active = loc.pathname === n.to
              const Icon = n.icon
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                    active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100',
                  )}
                >
                  <Icon size={16} />
                  {n.label}
                </Link>
              )
            })}
          </nav>
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              <LogOut size={16} />
              退出
            </button>
          </div>
        </aside>

        <main className="rounded-xl border border-zinc-200 bg-white p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
