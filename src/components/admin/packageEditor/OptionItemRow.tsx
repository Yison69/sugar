import type { PackageOptionItem, PriceOp } from '../../../../shared/types'
import Input from '@/components/ui/Input'

export default function OptionItemRow({
  op,
  item,
  onChange,
  onDelete,
}: {
  op: PriceOp
  item: PackageOptionItem
  onChange: (patch: Partial<PackageOptionItem>) => void
  onDelete: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg bg-zinc-50 p-3 md:grid-cols-[1fr_140px_120px]">
      <div>
        <div className="mb-1 text-xs font-medium text-zinc-700">名称</div>
        <Input value={item.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-zinc-700">价格变化（元）</div>
        <Input value={String(item.deltaPrice)} onChange={(e) => onChange({ deltaPrice: Number(e.target.value) })} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-xs text-zinc-500">
          {op === 'replace' ? '替换可为 0' : op === 'add' ? '加价建议为正数' : '减价可为负/正'}
        </div>
        <button type="button" className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50" onClick={onDelete}>
          删除
        </button>
      </div>
    </div>
  )
}

