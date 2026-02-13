import fs from 'node:fs/promises'
import path from 'node:path'

function deriveClientId(envId) {
  const idx = String(envId || '').indexOf('-')
  if (idx <= 0) return ''
  return String(envId).slice(idx + 1)
}

function pickEnv(...keys) {
  for (const k of keys) {
    const v = (process.env[k] || '').trim()
    if (v) return v
  }
  return ''
}

const root = process.cwd()
const distPath = path.join(root, 'dist', 'runtime-config.json')
const publicPath = path.join(root, 'public', 'runtime-config.json')

async function readJsonIfExists(filePath) {
  try {
    const s = await fs.readFile(filePath, 'utf8')
    return JSON.parse(s)
  } catch {
    return null
  }
}

const distCfg = (await readJsonIfExists(distPath)) || {}
const publicCfg = (await readJsonIfExists(publicPath)) || {}

const cloudbaseEnvId =
  pickEnv('RUNTIME_CLOUDBASE_ENV_ID', 'VITE_CLOUDBASE_ENV_ID') ||
  String(distCfg.cloudbaseEnvId || '').trim() ||
  String(publicCfg.cloudbaseEnvId || '').trim()

const adminApiHttpBase =
  pickEnv('RUNTIME_ADMIN_API_HTTP_BASE', 'VITE_ADMIN_API_HTTP_BASE') ||
  String(distCfg.adminApiHttpBase || '').trim() ||
  String(publicCfg.adminApiHttpBase || '').trim()

const adminMode =
  pickEnv('RUNTIME_ADMIN_MODE', 'VITE_ADMIN_MODE') ||
  String(distCfg.adminMode || '').trim() ||
  String(publicCfg.adminMode || '').trim() ||
  'cloud'

const basePath =
  pickEnv('RUNTIME_BASE_PATH', 'VITE_BASE_PATH') ||
  String(distCfg.basePath || '').trim() ||
  String(publicCfg.basePath || '').trim() ||
  ''

const cloudbaseClientId =
  pickEnv('RUNTIME_CLOUDBASE_CLIENT_ID', 'VITE_CLOUDBASE_CLIENT_ID') ||
  String(distCfg.cloudbaseClientId || '').trim() ||
  String(publicCfg.cloudbaseClientId || '').trim() ||
  deriveClientId(cloudbaseEnvId)

const notes =
  String(distCfg.notes || '').trim() ||
  String(publicCfg.notes || '').trim() ||
  '部署到云端后，填入 cloudbaseEnvId（例如 cloud1-xxxx）。留空会回退到构建时的 VITE_CLOUDBASE_ENV_ID。'

const merged = {
  adminMode,
  basePath,
  adminApiHttpBase,
  cloudbaseEnvId,
  cloudbaseClientId,
  notes,
}

await fs.mkdir(path.dirname(distPath), { recursive: true })
await fs.writeFile(distPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

