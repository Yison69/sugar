import cloudbase from '@cloudbase/js-sdk'
import { getRuntimeConfig } from '@/lib/runtimeConfig'

let appPromise: Promise<ReturnType<typeof cloudbase.init>> | null = null

function deriveClientId(env: string) {
  const idx = env.indexOf('-')
  if (idx <= 0 || idx >= env.length - 1) return ''
  return env.slice(idx + 1)
}

function deriveEnvIdFromHostname(hostname: string) {
  const host = (hostname || '').trim()
  if (!host) return ''

  const firstLabel = host.split('.')[0] || ''
  if (!firstLabel) return ''

  if (host.endsWith('.tcloudbaseapp.com')) {
    return firstLabel.replace(/-\d+$/, '')
  }

  return ''
}

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

function createAuth(app: unknown) {
  if (!app || typeof app !== 'object') return null
  const a = app as { auth?: (opts?: { persistence?: string }) => unknown }
  if (typeof a.auth !== 'function') return null
  try {
    return a.auth({ persistence: 'local' })
  } catch {
    try {
      return a.auth()
    } catch {
      return null
    }
  }
}

type CloudbaseAuth = {
  getLoginState?: () => Promise<unknown>
  signInAnonymously?: () => Promise<unknown>
  anonymousAuthProvider?: () => { signIn: () => Promise<unknown> }
}

async function ensureSignedIn(auth: CloudbaseAuth | null) {
  if (!auth) return

  try {
    if (typeof auth.getLoginState === 'function') {
      const loginState = await auth.getLoginState().catch(() => null)
      if (loginState) return
    }
  } catch {
    void 0
  }

  if (typeof auth.signInAnonymously === 'function') {
    await auth.signInAnonymously()
    return
  }

  if (typeof auth.anonymousAuthProvider === 'function') {
    await auth.anonymousAuthProvider().signIn()
    return
  }
}

export async function getCloudbaseApp() {
  if (appPromise) return appPromise
  appPromise = (async () => {
    const cfg = await getRuntimeConfig()
    const derived = typeof window !== 'undefined' ? deriveEnvIdFromHostname(window.location.hostname) : ''
    const env = (cfg.cloudbaseEnvId || (import.meta.env.VITE_CLOUDBASE_ENV_ID as string | undefined) || derived || '').trim()
    if (!env) {
      throw new Error(
        '缺少云开发环境 ID：请在站点的 /runtime-config.json 中填写 cloudbaseEnvId，或在构建时设置 VITE_CLOUDBASE_ENV_ID。',
      )
    }

    const clientId = (cfg.cloudbaseClientId || ((import.meta.env.VITE_CLOUDBASE_CLIENT_ID as string | undefined) ?? '').trim() || deriveClientId(env)).trim()

    const app = cloudbase.init(clientId ? { env, clientId } : { env })
    const auth = createAuth(app)
    try {
      await ensureSignedIn(auth)
    } catch (e) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
      throw new Error(
        `云开发 Web 鉴权失败：${toErrorMessage(e)}。请在 CloudBase 控制台→身份认证 开启「匿名登录」，并确保 ${origin} 已加入安全来源白名单。`,
      )
    }
    return app
  })()
  return appPromise
}
