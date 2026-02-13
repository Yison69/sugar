import type { PackageOptionGroup, PackageOptionItem, PriceOp } from '../../../../shared/types'
import Input from '@/components/ui/Input'
import OpBadge from '@/components/admin/packageEditor/OpBadge'
import OptionItemRow from '@/components/admin/packageEditor/OptionItemRow'

export default function OptionGroupCard({
  group,
  onChange,
  onDelete,
  onAddItem,
  onChangeItem,
  onDeleteItem,
}: {
  group: PackageOptionGroup
  onChange: (patch: Partial<PackageOptionGroup>) => void
  onDelete: () => void
  onAddItem: () => void
  onChangeItem: (itemId: string, patch: Partial<PackageOptionItem>) => void
  onDeleteItem: (itemId: string) => void
}) {
  const op = group.op
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-medium text-zinc-700">组名</div>
            <Input value={group.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">类型</div>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-900"
              value={group.op}
              onChange={(e) => {
                const nextOp = e.target.value as PriceOp
                onChange({ op: nextOp, selectMode: nextOp === 'replace' ? 'single' : group.selectMode })
              }}
            >
              <option value="replace">替换（差价可为 0）</option>
              <option value="add">加价</option>
              <option value="minus">减价</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-700">选择方式</div>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-900"
              value={group.selectMode}
              disabled={group.op === 'replace'}
              onChange={(e) => onChange({ selectMode: e.target.value as 'single' | 'multi' })}
            >
              <option value="single">单选</option>
              <option value="multi">多选</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={group.required} onChange={(e) => onChange({ required: e.target.checked })} />
            必选
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 md:justify-end">
          <OpBadge op={group.op} />
          <button type="button" className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50" onClick={onDelete}>
            删除组选
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-600">组内选项</div>
          <button type="button" className="rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100" onClick={onAddItem}>
            新增选项
          </button>
        </div>
        <div className="space-y-2">
          {group.items.length ? (
            group.items.map((it) => (
              <OptionItemRow
                key={it.id}
                op={op}
                item={it}
                onChange={(patch) => onChangeItem(it.id, patch)}
                onDelete={() => onDeleteItem(it.id)}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
              暂无选项，点击“新增选项”开始配置
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

