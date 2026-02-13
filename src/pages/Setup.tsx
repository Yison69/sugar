import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminApi } from '@/lib/adminApi'
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig'
import { diagnoseHttpSetup } from '@/lib/adminApiHttp'

export default function Setup() {
  const runtime = useRuntimeConfig()
  const isLocal = (runtime?.adminMode || ((import.meta.env.VITE_ADMIN_MODE as string | undefined) ?? '').trim()) === 'local'
  const backend = isLocal ? 'local' : runtime?.adminApiHttpBase ? 'http' : 'cloud'
  const runtimeHref = typeof window !== 'undefined' ? `${window.location.origin}/runtime-config.json` : '/runtime-config.json'
  const siteHost = typeof window !== 'undefined' ? window.location.host : ''
  const defaultLocalKey = ((import.meta.env.VITE_LOCAL_SETUP_KEY as string | undefined) ?? '').trim()
  const [setupKey, setSetupKey] = useState(isLocal ? defaultLocalKey : '')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diag, setDiag] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-base font-semibold text-zinc-900">初始化管理员</div>
          <div className="mt-1 text-sm text-zinc-600">只需执行一次；如已存在管理员会提示失败</div>
          <div className="mt-3 rounded-md bg-zinc-50 p-3 text-xs text-zinc-700">
            <div>当前站点：{siteHost || '-'}</div>
            <div>
              当前后端：{backend === 'cloud' ? '云调用' : backend === 'http' ? 'HTTP 访问服务' : '本地离线'}
            </div>
            <div>cloudbaseEnvId：{runtime?.cloudbaseEnvId || '（未配置）'}</div>
            <div>adminApiHttpBase：{runtime?.adminApiHttpBase || '（未配置）'}</div>
            <a className="mt-1 inline-block text-zinc-900 underline" href={runtimeHref} target="_blank" rel="noreferrer">
              打开 runtime-config.json
            </a>

            {backend === 'http' && runtime?.adminApiHttpBase ? (
              <div className="mt-2">
                <Button
                  className="w-full"
                  disabled={diagLoading}
                  onClick={async () => {
                    setDiag(null)
                    setDiagLoading(true)
                    try {
                      const r = await diagnoseHttpSetup(runtime.adminApiHttpBase as string)
                      setDiag(JSON.stringify(r, null, 2))
                    } finally {
                      setDiagLoading(false)
                    }
                  }}
                  type="button"
                >
                  {diagLoading ? '测试中…' : '测试 HTTP 后端连通性'}
                </Button>
              </div>
            ) : null}
          </div>
          {isLocal ? (
            <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              当前为本地离线模式：数据只保存在浏览器本地，不会同步到云端。
            </div>
          ) : null}

          {done ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">初始化成功</div>
              <Link to="/login" className="block">
                <Button className="w-full">去登录</Button>
              </Link>
            </div>
          ) : (
            <form
              className="mt-5 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                setError(null)
                setLoading(true)
                try {
                  await adminApi.setup(setupKey.trim(), username.trim(), password)
                  setDone(true)
                } catch (err) {
                  const msg = err instanceof Error ? err.message : '初始化失败'
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
                <div className="mb-1 text-xs font-medium text-zinc-700">ADMIN_SETUP_KEY</div>
                <Input value={setupKey} onChange={(e) => setSetupKey(e.target.value)} placeholder="在云函数环境变量里设置的那串" />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">管理员账号</div>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">管理员密码</div>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="建议 12 位以上" />
              </div>

              {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

              {diag ? (
                <div className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-700 whitespace-pre-wrap">{diag}</div>
              ) : null}

              <Button disabled={loading || !setupKey.trim() || !username.trim() || !password} className="w-full" type="submit">
                {loading ? '初始化中…' : '初始化管理员'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
