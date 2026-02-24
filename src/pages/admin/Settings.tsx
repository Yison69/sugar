import { useEffect, useState } from 'react'
import PageHeader from '@/components/admin/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminApi } from '@/lib/adminApi'
import { useAdminAuth } from '@/stores/adminAuth'
import CloudUploadButton from '@/components/admin/CloudUploadButton'
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig'

export default function AdminSettings() {
  const token = useAdminAuth((s) => s.token)
  const runtime = useRuntimeConfig()
  const isLocal = (runtime?.adminMode || ((import.meta.env.VITE_ADMIN_MODE as string | undefined) ?? '').trim()) === 'local'
  const [wechatText, setWechatText] = useState('')
  const [wechatQrUrl, setWechatQrUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mpUsername, setMpUsername] = useState('')
  const [mpPassword, setMpPassword] = useState('')
  const [mpHasPassword, setMpHasPassword] = useState(false)
  const [savingMp, setSavingMp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const [contactCfg, mpCfg] = await Promise.all([adminApi.getContactConfig(), adminApi.getMiniProgramLoginConfig()])
      setWechatText(contactCfg.wechatText || '')
      setWechatQrUrl(contactCfg.wechatQrUrl || '')
      setMpUsername(mpCfg.username || '')
      setMpHasPassword(!!mpCfg.hasPassword)
      setMpPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div>
      <PageHeader title="系统设置" />
      {error ? <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {isLocal ? (
        <div className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          当前为本地离线模式：此处保存的联系方式只保存在浏览器本地，不会同步到小程序云端。
        </div>
      ) : null}

      {isLocal ? (
        <div className="mb-3 rounded-md border border-zinc-200 bg-white p-4">
          <div className="text-sm font-medium text-zinc-900">本地数据导入/导出</div>
          <div className="mt-1 text-xs text-zinc-600">用于先离线管理内容，后续再迁移到云端。</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={async () => {
                try {
                  const all = await adminApi.exportAll()
                  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'photographer-admin-export.json'
                  a.click()
                  URL.revokeObjectURL(url)
                } catch (err) {
                  alert(err instanceof Error ? err.message : '导出失败')
                }
              }}
            >
              导出 JSON
            </Button>
            <Button
              type="button"
              className="bg-zinc-900"
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'application/json'
                input.onchange = async () => {
                  const f = input.files && input.files[0]
                  if (!f) return
                  const text = await f.text()
                  try {
                    const payload = JSON.parse(text)
                    await adminApi.importAll(payload)
                    await load()
                    alert('导入成功')
                  } catch (err) {
                    alert(err instanceof Error ? err.message : '导入失败')
                  }
                }
                input.click()
              }}
            >
              导入 JSON
            </Button>
            {token ? <div className="text-xs text-zinc-500">已登录</div> : <div className="text-xs text-zinc-500">未登录</div>}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 p-4">
        <div className="mb-3 text-sm font-medium text-zinc-900">联系方式</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">微信号文字</div>
            <Input value={wechatText} onChange={(e) => setWechatText(e.target.value)} placeholder="例如：photographer_xxx" />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">二维码图片 URL / cloud:// fileID</div>
            <Input value={wechatQrUrl} onChange={(e) => setWechatQrUrl(e.target.value)} placeholder="cloud://xxx/qrcode.jpg" />
            {!isLocal ? (
              <div className="mt-2">
                <CloudUploadButton
                  label="上传二维码"
                  accept="image/*"
                  prefix="config/qrcode"
                  onUploaded={(ids) => setWechatQrUrl(ids[0] || wechatQrUrl)}
                />
              </div>
            ) : (
              <div className="mt-2 text-xs text-amber-700">本地离线模式不支持上传到云存储；切到云开发模式后可一键上传并回填。</div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-zinc-500">小程序端“联系我/门店咨询”等入口会使用以上信息。</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              disabled={loading || saving}
              onClick={() => load()}
            >
              刷新
            </button>
            <Button
              type="button"
              disabled={loading || saving}
              onClick={async () => {
                setSaving(true)
                try {
                  await adminApi.updateContactConfig({ wechatText: wechatText.trim(), wechatQrUrl: wechatQrUrl.trim() })
                  alert('已保存')
                } catch (err) {
                  alert(err instanceof Error ? err.message : '保存失败')
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 p-4">
        <div className="text-sm font-medium text-zinc-900">小程序登录</div>
        <div className="mt-1 text-xs text-zinc-500">小程序打开后会先显示登录页，用户输入此处配置的账号密码后才能进入。</div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">登录账号</div>
            <Input value={mpUsername} onChange={(e) => setMpUsername(e.target.value)} placeholder="例如：studio_user" />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">登录密码</div>
            <Input
              type="password"
              value={mpPassword}
              onChange={(e) => setMpPassword(e.target.value)}
              placeholder={mpHasPassword ? '留空表示不修改密码' : '请输入登录密码'}
            />
            <div className="mt-2 text-xs text-zinc-500">
              {mpHasPassword ? '已配置密码；如需修改请输入新密码后保存。' : '当前未配置密码，首次保存必须填写密码。'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-zinc-500">保存后，小程序端新登录会按最新账号密码校验。</div>
          <Button
            type="button"
            disabled={loading || savingMp}
            onClick={async () => {
              setSavingMp(true)
              try {
                const next = await adminApi.updateMiniProgramLoginConfig({ username: mpUsername.trim(), password: mpPassword })
                setMpUsername(next.username || mpUsername.trim())
                setMpHasPassword(!!next.hasPassword)
                setMpPassword('')
                alert('已保存')
              } catch (err) {
                alert(err instanceof Error ? err.message : '保存失败')
              } finally {
                setSavingMp(false)
              }
            }}
          >
            {savingMp ? '保存中…' : '保存登录配置'}
          </Button>
        </div>
      </div>
    </div>
  )
}
