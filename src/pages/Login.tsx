import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminApi } from '@/lib/adminApi'
import { useAdminAuth } from '@/stores/adminAuth'
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig'

export default function Login() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const next = useMemo(() => sp.get('next') || '/admin/works', [sp])

  const runtime = useRuntimeConfig()
  const isLocal = (runtime?.adminMode || ((import.meta.env.VITE_ADMIN_MODE as string | undefined) ?? '').trim()) === 'local'
  const backend = isLocal ? 'local' : runtime?.adminApiHttpBase ? 'http' : 'cloud'
  const runtimeHref = typeof window !== 'undefined' ? `${window.location.origin}/runtime-config.json` : '/runtime-config.json'

  const setToken = useAdminAuth((s) => s.setToken)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-base font-semibold text-zinc-900">管理端登录</div>
          <div className="mt-1 text-sm text-zinc-600">输入账号密码进入作品/套餐/预约管理</div>

          <div className="mt-3 rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
            <div>
              当前后端：{backend === 'cloud' ? '云调用' : backend === 'http' ? 'HTTP 访问服务' : '本地离线'}
            </div>
            <div>cloudbaseEnvId：{runtime?.cloudbaseEnvId || '（未配置）'}</div>
            <div>adminApiHttpBase：{runtime?.adminApiHttpBase || '（未配置）'}</div>
            <a className="mt-1 inline-block text-zinc-900 underline" href={runtimeHref} target="_blank" rel="noreferrer">
              打开 runtime-config.json
            </a>
          </div>

          <form
            className="mt-5 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              setLoading(true)
              try {
                const res = await adminApi.login(username.trim(), password)
                setToken(res.token)
                navigate(next, { replace: true })
              } catch (err) {
                const msg = err instanceof Error ? err.message : '登录失败'
                if (msg.includes('credentials not found') && runtime?.adminApiHttpBase) {
                  setError(
                    `${msg}\n（已配置 adminApiHttpBase 但仍出现 credentials not found：通常是前端没更新到最新 dist，或当前页面实际没读取到同域名下的 runtime-config.json；请重新部署最新 dist.zip，并确认上方 adminApiHttpBase 非空）`,
                  )
                } else {
                  setError(msg)
                }
              } finally {
                setLoading(false)
              }
            }}
          >
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">账号</div>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">密码</div>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
              />
            </div>

            {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

            <Button disabled={loading || !username.trim() || !password} className="w-full" type="submit">
              {loading ? '登录中…' : '登录'}
            </Button>

            <div className="text-xs text-zinc-500">
              需要先在云开发里初始化管理员账号（见 README）。
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
