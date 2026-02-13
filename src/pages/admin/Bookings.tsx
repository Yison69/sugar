import { useEffect, useMemo, useState } from 'react'
import type { Booking, BookingStatus } from '../../../shared/types'
import { adminApi } from '@/lib/adminApi'
import PageHeader from '@/components/admin/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'

const STATUSES: BookingStatus[] = ['待确认', '已确认', '已完成', '已取消']

export default function AdminBookings() {
  const [items, setItems] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<Booking | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<BookingStatus>('待确认')
  const [adminNote, setAdminNote] = useState('')

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await adminApi.listBookings()
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
    return items.filter((b) =>
      [b.contactName, b.contactPhone, b.contactWechat, b.shootingType, b.itemTitleSnapshot]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [items, query])

  return (
    <div>
      <PageHeader
        title="预约管理"
        right={<Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索手机号/微信号/类型" className="w-64" />}
      />

      {error ? <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <div className="grid grid-cols-[1fr_160px_160px_120px_120px] gap-0 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-600">
          <div>预约内容</div>
          <div>预约时间</div>
          <div>联系方式</div>
          <div>状态</div>
          <div className="text-right">操作</div>
        </div>
        <div className="divide-y divide-zinc-100">
          {loading ? (
            <div className="p-4 text-sm text-zinc-500">加载中…</div>
          ) : filtered.length ? (
            filtered.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-[1fr_160px_160px_120px_120px] items-center gap-0 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-900">{b.itemTitleSnapshot}</div>
                  <div className="truncate text-xs text-zinc-500">{b.shootingType}</div>
                </div>
                <div className="text-zinc-700">{b.scheduledAt}</div>
                <div className="min-w-0 text-zinc-700">
                  <div className="truncate">{b.contactPhone}</div>
                  <div className="truncate text-xs text-zinc-500">{b.contactWechat}</div>
                </div>
                <div className="text-zinc-700">{b.status}</div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                    onClick={() => {
                      setCurrent(b)
                      setStatus(b.status)
                      setAdminNote(b.adminNote ?? '')
                      setOpen(true)
                    }}
                  >
                    处理
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-sm text-zinc-500">暂无预约</div>
          )}
        </div>
      </div>

      <Modal
        open={open}
        title="预约处理"
        onClose={() => {
          if (!saving) setOpen(false)
        }}
      >
        {current ? (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setSaving(true)
              try {
                const res = await adminApi.updateBookingStatus(current.id, status, adminNote.trim() || undefined)
                setOpen(false)
                setCurrent(null)
                setItems((prev) => prev.map((x) => (x.id === res.item.id ? res.item : x)))
              } catch (err) {
                alert(err instanceof Error ? err.message : '更新失败')
              } finally {
                setSaving(false)
              }
            }}
          >
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="text-sm font-semibold text-zinc-900">{current.itemTitleSnapshot}</div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-zinc-700 md:grid-cols-2">
                <div>代称：{current.contactName}</div>
                <div>手机号：{current.contactPhone}</div>
                <div>微信号：{current.contactWechat}</div>
                <div>拍摄类型：{current.shootingType}</div>
                <div className="md:col-span-2">预约时间：{current.scheduledAt}</div>
                {current.remark ? <div className="md:col-span-2">备注：{current.remark}</div> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-700">状态</div>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-900"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BookingStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-medium text-zinc-700">管理员备注（可选）</div>
                <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
              </div>
            </div>

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
        ) : (
          <div className="text-sm text-zinc-600">无数据</div>
        )}
      </Modal>
    </div>
  )
}

