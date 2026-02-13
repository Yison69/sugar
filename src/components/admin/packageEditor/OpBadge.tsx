import type { PriceOp } from '../../../../shared/types'

export default function OpBadge({ op }: { op: PriceOp }) {
  const label = op === 'replace' ? '替换' : op === 'add' ? '加价' : '减价'
  const cls =
    op === 'replace'
      ? 'bg-zinc-100 text-zinc-700'
      : op === 'add'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-amber-50 text-amber-700'
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${cls}`}>{label}</span>
}

