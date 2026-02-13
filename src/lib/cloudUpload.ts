import { getCloudbaseApp } from '@/lib/cloudbase'
import { getRuntimeConfig } from '@/lib/runtimeConfig'
import { useAdminAuth } from '@/stores/adminAuth'

function safeFileName(name: string) {
  const base = name.trim() || 'file'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return cleaned.slice(0, 80)
}

function rand() {
  return Math.random().toString(36).slice(2, 10)
}

export async function uploadToCloudStorage(
  file: File,
  opts: { prefix: string; onProgress?: (percent: number) => void },
) {
  const cfg = await getRuntimeConfig()
  if (cfg.adminApiHttpBase) {
    const token = useAdminAuth.getState().token
    if (!token) throw new Error('未登录')

    const ab = await file.arrayBuffer()
    const bytes = new Uint8Array(ab)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const contentBase64 = btoa(binary)

    const res = await fetch(`${cfg.adminApiHttpBase.replace(/\/+$/, '')}/api/admin/upload`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
      body: JSON.stringify({ token, prefix: opts.prefix, fileName: file.name, contentBase64 }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error((json && (json.error || json.message)) || '上传失败')
    if (!json || !json.fileID) throw new Error('上传失败')
    return { fileID: json.fileID as string, cloudPath: (json.cloudPath || '') as string }
  }

  const app: any = await getCloudbaseApp()
  const name = safeFileName(file.name)
  const cloudPath = `${opts.prefix}/${Date.now()}_${rand()}_${name}`
  const res = await app.uploadFile({
    cloudPath,
    filePath: file,
    onUploadProgress: (e: ProgressEvent) => {
      const total = (e && (e as any).total) || 0
      const loaded = (e && (e as any).loaded) || 0
      if (!total) return
      const pct = Math.max(0, Math.min(100, Math.round((loaded * 100) / total)))
      opts.onProgress?.(pct)
    },
  })
  return { fileID: res.fileID as string, cloudPath }
}
