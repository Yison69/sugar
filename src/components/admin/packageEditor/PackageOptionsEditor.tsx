import type { PackageOptionGroup, PackageOptionItem } from '../../../../shared/types'
import Button from '@/components/ui/Button'
import OptionGroupCard from '@/components/admin/packageEditor/OptionGroupCard'
import { newId } from '@/components/admin/packageEditor/id'

export default function PackageOptionsEditor({
  groups,
  onChange,
}: {
  groups: PackageOptionGroup[]
  onChange: (next: PackageOptionGroup[]) => void
}) {
  const updateGroup = (groupId: string, patch: Partial<PackageOptionGroup>) => {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)))
  }

  const removeGroup = (groupId: string) => {
    onChange(groups.filter((g) => g.id !== groupId))
  }

  const addGroup = () => {
    const id = newId()
    const g: PackageOptionGroup = {
      id,
      name: '选项组',
      op: 'replace',
      required: true,
      selectMode: 'single',
      items: [],
    }
    onChange([...groups, g])
  }

  const addItem = (groupId: string) => {
    const item: PackageOptionItem = { id: newId(), name: '选项', op: 'replace', deltaPrice: 0 }
    onChange(
      groups.map((g) => (g.id === groupId ? { ...g, items: [...g.items, { ...item, op: g.op }] } : g)),
    )
  }

  const updateItem = (groupId: string, itemId: string, patch: Partial<PackageOptionItem>) => {
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
        <div className="text-sm font-semibold text-zinc-900">选项组与加减价规则</div>
        <Button type="button" onClick={addGroup}>
          新增选项组
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {groups.length ? (
          groups.map((g) => (
            <OptionGroupCard
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
          <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">
            暂无选项组，点击右上角“新增选项组”开始配置
          </div>
        )}
      </div>
    </div>
  )
}

