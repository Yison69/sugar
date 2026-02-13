import type { ReactNode } from 'react'

export default function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          <button
            className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
            onClick={onClose}
            type="button"
          >
            关闭
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

