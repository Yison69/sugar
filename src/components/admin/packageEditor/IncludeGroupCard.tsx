import type { PackageIncludeGroup, PackageIncludeItem } from '../../../../shared/types'
import Input from '@/components/ui/Input'
import IncludeItemRow from '@/components/admin/packageEditor/IncludeItemRow'

export default function IncludeGroupCard({
  group,
  onChange,
  onDelete,
  onAddItem,
  onChangeItem,
  onDeleteItem,
}: {
  group: PackageIncludeGroup
  onChange: (patch: Partial<PackageIncludeGroup>) => void
  onDelete: () => void
  onAddItem: () => void
  onChangeItem: (itemId: string, patch: Partial<PackageIncludeItem>) => void
  onDeleteItem: (itemId: string) => void
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 text-xs font-medium text-zinc-700">组名</div>
          <Input value={group.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <button type="button" className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50" onClick={onDelete}>
          删除
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-600">组内条目</div>
          <button type="button" className="rounded-md px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100" onClick={onAddItem}>
            新增条目
          </button>
        </div>
        <div className="space-y-2">
          {group.items.length ? (
            group.items.map((it) => (
              <IncludeItemRow
                key={it.id}
                item={it}
                onChange={(patch) => onChangeItem(it.id, patch)}
                onDelete={() => onDeleteItem(it.id)}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">暂无条目，点击“新增条目”开始配置</div>
          )}
        </div>
      </div>
    </div>
  )
}

