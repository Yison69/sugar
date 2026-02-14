import type { PackageIncludeItem } from '../../../../shared/types'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import OptionAssetsEditor from '@/components/admin/packageEditor/OptionAssetsEditor'

export default function IncludeItemRow({
  item,
  onChange,
  onDelete,
}: {
  item: PackageIncludeItem
  onChange: (patch: Partial<PackageIncludeItem>) => void
  onDelete: () => void
}) {
  const assetCount = Array.isArray(item.assetUrls) ? item.assetUrls.length : 0
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <div className="flex items-end justify-between gap-2">
        <div className="flex-1">
          <div className="mb-1 text-xs font-medium text-zinc-700">名称</div>
          <Input value={item.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <button type="button" className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50" onClick={onDelete}>
          删除
        </button>
      </div>

      <div className="mt-2">
        <div className="mb-1 text-xs font-medium text-zinc-700">说明（可选）</div>
        <Textarea value={item.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} />
      </div>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white p-3">
        <summary className="cursor-pointer text-xs font-medium text-zinc-700">资源（{assetCount}）</summary>
        <div className="mt-3">
          <OptionAssetsEditor item={item} onChange={(patch) => onChange(patch)} />
        </div>
      </details>
    </div>
  )
}

