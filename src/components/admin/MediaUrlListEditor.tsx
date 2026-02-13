import { useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { uploadToCloudStorage } from '@/lib/cloudUpload'

function kindFromUrl(url: string): 'image' | 'video' | 'file' {
  const u = String(url || '').toLowerCase()
  if (u.endsWith('.mp4') || u.endsWith('.mov') || u.endsWith('.webm')) return 'video'
  if (u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.gif') || u.endsWith('.webp')) return 'image'
  return 'file'
}

export default function MediaUrlListEditor({
  title,
  description,
  urls,
  accept,
  prefix,
  multiple,
  disabled,
  onChange,
}: {
  title: string
  description?: string
  urls: string[]
  accept: string
  prefix: string
  multiple?: boolean
  disabled?: boolean
  onChange: (next: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length) return
    const next = urls.slice()
    const it = next.splice(from, 1)[0]
    next.splice(to, 0, it)
    onChange(next)
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-zinc-700">{title}</div>
          {description ? <div className="mt-1 text-xs text-zinc-500">{description}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || [])
              e.currentTarget.value = ''
              if (!files.length) return
              setUploading(true)
              try {
                const next = urls.slice()
                for (const f of files) {
                  const { fileID } = await uploadToCloudStorage(f, { prefix })
                  next.push(fileID)
                }
                onChange(next)
              } catch (err) {
                alert(err instanceof Error ? err.message : '上传失败')
              } finally {
                setUploading(false)
              }
            }}
          />
          <Button
            type="button"
            disabled={disabled || uploading}
            onClick={() => {
              inputRef.current?.click()
            }}
          >
            {uploading ? '上传中…' : '上传'}
          </Button>
        </div>
      </div>

      {urls.length ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {urls.map((u, idx) => {
            const kind = kindFromUrl(u)
            return (
              <div key={u + String(idx)} className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg bg-zinc-200">
                  {kind === 'image' ? (
                    <img src={u} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-zinc-700">
                      {kind === 'video' ? '视频' : '文件'}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-zinc-700">{u}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                      onClick={() => move(idx, idx - 1)}
                      disabled={disabled || idx === 0}
                    >
                      上移
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                      onClick={() => move(idx, idx + 1)}
                      disabled={disabled || idx === urls.length - 1}
                    >
                      下移
                    </button>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      onClick={() => onChange(urls.filter((_, i) => i !== idx))}
                      disabled={disabled}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">暂无资源</div>
      )}
    </div>
  )
}

