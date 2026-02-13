import { useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { uploadToCloudStorage } from '@/lib/cloudUpload'

export default function CloudUploadButton({
  label,
  accept,
  multiple,
  prefix,
  disabled,
  onUploaded,
}: {
  label: string
  accept?: string
  multiple?: boolean
  prefix: string
  disabled?: boolean
  onUploaded: (fileIds: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState<number | null>(null)

  return (
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
          setPercent(0)
          try {
            const ids: string[] = []
            for (let i = 0; i < files.length; i++) {
              const { fileID } = await uploadToCloudStorage(files[i], {
                prefix,
                onProgress: (p) => setPercent(p),
              })
              ids.push(fileID)
            }
            onUploaded(ids)
          } catch (err) {
            alert(err instanceof Error ? err.message : '上传失败')
          } finally {
            setUploading(false)
            setPercent(null)
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
        {uploading ? (percent != null ? `上传中 ${percent}%` : '上传中…') : label}
      </Button>
      <div className="text-xs text-zinc-500">上传后会自动回填 `cloud://` fileID</div>
    </div>
  )
}

