import { useEffect, useMemo, useState } from 'react'
import type { Package } from '../../../shared/types'
import { adminApi } from '@/lib/adminApi'
import PageHeader from '@/components/admin/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import PackageEditor from '@/components/admin/packageEditor/PackageEditor'
import { toPackageDraft, type PackageDraft } from '@/components/admin/packageEditor/draft'

export default function AdminPackages() {
  const [items, setItems] = useState<Package[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PackageDraft>(toPackageDraft())
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await adminApi.listPackages()
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
        title="套餐管理"
        right={
          <>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题" className="w-52" />
            <Button
              type="button"
              onClick={() => {
                setDraft(toPackageDraft())
                setOpen(true)
              }}
            >
              新增套餐
            </Button>
          </>
        }
      />

      {error ? <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <div className="grid grid-cols-[1fr_140px_120px_120px_120px] gap-0 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-600">
          <div>标题</div>
          <div>基础价</div>
          <div>分类</div>
          <div>上架</div>
          <div className="text-right">操作</div>
        </div>
        <div className="divide-y divide-zinc-100">
          {loading ? (
            <div className="p-4 text-sm text-zinc-500">加载中…</div>
          ) : filtered.length ? (
            filtered.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_140px_120px_120px_120px] items-center gap-0 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-900">{p.title}</div>
                  <div className="truncate text-xs text-zinc-500">{p.optionGroups?.length ?? 0} 个选项组</div>
                </div>
                <div className="text-zinc-700">¥ {p.basePrice}</div>
                <div className="text-zinc-700">{p.category}</div>
                <div className="text-zinc-700">{p.isPublished ? '是' : '否'}</div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                    onClick={() => {
                      setDraft(toPackageDraft(p))
                      setOpen(true)
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={async () => {
                      if (!confirm('确认删除该套餐？')) return
                      try {
                        await adminApi.deletePackage(p.id)
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
            <div className="p-4 text-sm text-zinc-500">暂无套餐</div>
          )}
        </div>
      </div>

      <Modal
        open={open}
        title={draft.id ? '编辑套餐' : '新增套餐'}
        onClose={() => {
          if (!saving) setOpen(false)
        }}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setSaving(true)
            try {
              const basePrice = Number(draft.basePrice)
              if (!draft.title.trim()) throw new Error('标题不能为空')
              if (!draft.coverUrl.trim()) throw new Error('封面地址不能为空')
              if (!Number.isFinite(basePrice) || basePrice < 0) throw new Error('基础价不合法')
              const cleanedGroups = draft.optionGroups.map((g) => ({
                ...g,
                name: g.name.trim(),
                items: g.items.map((it) => ({
                  ...it,
                  name: it.name.trim(),
                  op: g.op,
                  deltaPrice: Number(it.deltaPrice),
                })),
              }))
              for (const g of cleanedGroups) {
                if (!g.name) throw new Error('存在空的选项组名称')
                if (g.op === 'replace') g.selectMode = 'single'
                for (const it of g.items) {
                  if (!it.name) throw new Error(`选项组「${g.name}」存在空的选项名称`)
                  if (!Number.isFinite(it.deltaPrice)) throw new Error(`选项「${it.name}」价格变化不合法`)
                }
              }
              await adminApi.upsertPackage({
                id: draft.id,
                title: draft.title.trim(),
                category: draft.category,
                coverUrl: draft.coverUrl.trim(),
                basePrice,
                description: draft.description.trim() || undefined,
                deliverables: draft.deliverables.trim() || undefined,
                optionGroups: cleanedGroups,
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
          <PackageEditor draft={draft} onChange={setDraft} />

          <div className="flex items-center justify-end gap-2">
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
