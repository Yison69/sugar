import type { PackageIncludeGroup, PackageIncludeItem } from '../../../../shared/types'
import Button from '@/components/ui/Button'
import IncludeGroupCard from '@/components/admin/packageEditor/IncludeGroupCard'
import { newId } from '@/components/admin/packageEditor/id'

export default function PackageIncludesEditor({
  groups,
  onChange,
}: {
  groups: PackageIncludeGroup[]
  onChange: (next: PackageIncludeGroup[]) => void
}) {
  const updateGroup = (groupId: string, patch: Partial<PackageIncludeGroup>) => {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)))
  }

  const removeGroup = (groupId: string) => {
    onChange(groups.filter((g) => g.id !== groupId))
  }

  const addGroup = () => {
    const id = newId()
    const g: PackageIncludeGroup = { id, name: '包含内容', items: [] }
    onChange([...groups, g])
  }

  const addItem = (groupId: string) => {
    const item: PackageIncludeItem = { id: newId(), name: '条目', description: '', qty: '', assetUrls: [] }
    onChange(groups.map((g) => (g.id === groupId ? { ...g, items: [...g.items, item] } : g)))
  }

  const updateItem = (groupId: string, itemId: string, patch: Partial<PackageIncludeItem>) => {
    onChange(
      groups.map((g) =>
        g.id !== groupId ? g : { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) },
      ),
    )
  }

  const removeItem = (groupId: string, itemId: string) => {
    onChange(groups.map((g) => (g.id !== groupId ? g : { ...g, items: g.items.filter((it) => it.id !== itemId) })))
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900">套餐内容（包含）</div>
          <div className="mt-1 text-xs text-zinc-500">用于展示套餐固定包含的内容，不参与金额计算。</div>
        </div>
        <Button type="button" onClick={addGroup}>
          新增内容组
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {groups.length ? (
          groups.map((g) => (
            <IncludeGroupCard
              key={g.id}
              group={g}
              onChange={(patch) => updateGroup(g.id, patch)}
              onDelete={() => removeGroup(g.id)}
              onAddItem={() => addItem(g.id)}
              onChangeItem={(itemId, patch) => updateItem(g.id, itemId, patch)}
              onDeleteItem={(itemId) => removeItem(g.id, itemId)}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">暂无内容组，点击右上角“新增内容组”开始配置</div>
        )}
      </div>
    </div>
  )
}
