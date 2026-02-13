import { useEffect, useMemo, useState } from 'react'
import type { Category, Work } from '../../../shared/types'
import { CATEGORIES } from '@/lib/constants'
import { adminApi } from '@/lib/adminApi'
import PageHeader from '@/components/admin/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import CloudUploadButton from '@/components/admin/CloudUploadButton'
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig'

type WorkDraft = {
  id?: string
  title: string
  category: Category
  coverUrl: string
  imageUrlsText: string
  description: string
  isPublished: boolean
}

const toDraft = (w?: Work): WorkDraft =>
  w
    ? {
        id: w.id,
        title: w.title,
        category: w.category,
        coverUrl: w.coverUrl,
        imageUrlsText: w.imageUrls.join('\n'),
        description: w.description ?? '',
        isPublished: w.isPublished,
      }
    : {
        title: '',
        category: '写真照',
        coverUrl: '',
        imageUrlsText: '',
        description: '',
        isPublished: true,
      }

export default function AdminWorks() {
  const runtime = useRuntimeConfig()
  const isLocal = (runtime?.adminMode || ((import.meta.env.VITE_ADMIN_MODE as string | undefined) ?? '').trim()) === 'local'
  const [items, setItems] = useState<Work[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<WorkDraft>(toDraft())
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await adminApi.listWorks()
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.title.toLowerCase().includes(q))
  }, [items, query])

  return (
    <div>
      <PageHeader
        title="作品管理"
        right={
          <>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题" className="w-52" />
            <Button
              type="button"
              onClick={() => {
                setDraft(toDraft())
                setOpen(true)
              }}
            >
              新增作品
            </Button>
          </>
        }
      />

      {error ? <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <div className="grid grid-cols-[1fr_120px_120px_120px_120px] gap-0 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-600">
          <div>标题</div>
          <div>分类</div>
          <div>上架</div>
          <div>点赞</div>
          <div className="text-right">操作</div>
        </div>
        <div className="divide-y divide-zinc-100">
          {loading ? (
            <div className="p-4 text-sm text-zinc-500">加载中…</div>
          ) : filtered.length ? (
            filtered.map((w) => (
              <div
                key={w.id}
                className="grid grid-cols-[1fr_120px_120px_120px_120px] items-center gap-0 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-900">{w.title}</div>
                  <div className="truncate text-xs text-zinc-500">{w.coverUrl}</div>
                </div>
                <div className="text-zinc-700">{w.category}</div>
                <div className="text-zinc-700">{w.isPublished ? '是' : '否'}</div>
                <div className="text-zinc-700">{w.likeCount}</div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                    onClick={() => {
                      setDraft(toDraft(w))
                      setOpen(true)
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={async () => {
                      if (!confirm('确认删除该作品？')) return
                      try {
                        await adminApi.deleteWork(w.id)
                        await load()
                      } catch (err) {
                        alert(err instanceof Error ? err.message : '删除失败')
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-sm text-zinc-500">暂无作品</div>
          )}
        </div>
      </div>

      <Modal
        open={open}
        title={draft.id ? '编辑作品' : '新增作品'}
        onClose={() => {
          if (!saving) setOpen(false)
        }}
      >
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setSaving(true)
            try {
              const imageUrls = draft.imageUrlsText
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean)
              if (!draft.title.trim()) throw new Error('标题不能为空')
              if (!draft.coverUrl.trim()) throw new Error('封面地址不能为空')
              if (!imageUrls.length) throw new Error('至少需要 1 张图片/视频地址')
              await adminApi.upsertWork({
                id: draft.id,
                title: draft.title.trim(),
                category: draft.category,
                coverUrl: draft.coverUrl.trim(),
                imageUrls,
                description: draft.description.trim() || undefined,
                isPublished: draft.isPublished,
              })
              setOpen(false)
              await load()
            } catch (err) {
              alert(err instanceof Error ? err.message : '保存失败')
            } finally {
              setSaving(false)
            }
          }}
        >
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">标题</div>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">分类</div>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-900"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-medium text-zinc-700">封面地址（建议 cloud:// fileID 或 https:// URL）</div>
            <Input value={draft.coverUrl} onChange={(e) => setDraft({ ...draft, coverUrl: e.target.value })} />
            {!isLocal ? (
              <div className="mt-2">
                <CloudUploadButton
                  label="上传封面"
                  accept="image/*"
                  prefix="works/cover"
                  onUploaded={(ids) => setDraft({ ...draft, coverUrl: ids[0] || draft.coverUrl })}
                />
              </div>
            ) : (
              <div className="mt-2 text-xs text-amber-700">本地离线模式不支持上传到云存储；切到云开发模式后可一键上传并回填。</div>
            )}
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-medium text-zinc-700">图片/视频地址（每行 1 个）</div>
            <Textarea
              value={draft.imageUrlsText}
              onChange={(e) => setDraft({ ...draft, imageUrlsText: e.target.value })}
              placeholder="cloud://xxx/1.jpg\ncloud://xxx/2.mp4"
            />
            {!isLocal ? (
              <div className="mt-2">
                <CloudUploadButton
                  label="上传图片/视频"
                  accept="image/*,video/*"
                  multiple
                  prefix="works/media"
                  onUploaded={(ids) => {
                    const curr = draft.imageUrlsText.trim()
                    const add = ids.join('\n')
                    setDraft({ ...draft, imageUrlsText: curr ? `${curr}\n${add}` : add })
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-medium text-zinc-700">说明（可选）</div>
            <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })}
            />
            <div className="text-sm text-zinc-700">上架</div>
          </div>

          <div className="flex items-center justify-end gap-2 md:col-span-2">
            <button
              type="button"
              className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              取消
            </button>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
