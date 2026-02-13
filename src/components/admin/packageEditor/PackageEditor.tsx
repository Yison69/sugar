import type { Category } from '../../../../shared/types'
import { CATEGORIES } from '@/lib/constants'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import PackageOptionsEditor from '@/components/admin/packageEditor/PackageOptionsEditor'
import type { PackageDraft } from '@/components/admin/packageEditor/draft'
import CloudUploadButton from '@/components/admin/CloudUploadButton'
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig'

export default function PackageEditor({ draft, onChange }: { draft: PackageDraft; onChange: (d: PackageDraft) => void }) {
  const runtime = useRuntimeConfig()
  const isLocal = (runtime?.adminMode || ((import.meta.env.VITE_ADMIN_MODE as string | undefined) ?? '').trim()) === 'local'
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-700">标题</div>
          <Input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-700">分类</div>
          <select
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-900"
            value={draft.category}
            onChange={(e) => onChange({ ...draft, category: e.target.value as Category })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-700">基础价（元）</div>
          <Input value={draft.basePrice} onChange={(e) => onChange({ ...draft, basePrice: e.target.value })} />
        </div>
        <div className="flex items-end gap-2">
          <input
            type="checkbox"
            checked={draft.isPublished}
            onChange={(e) => onChange({ ...draft, isPublished: e.target.checked })}
          />
          <div className="text-sm text-zinc-700">上架</div>
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-medium text-zinc-700">封面地址（建议 cloud:// fileID 或 https:// URL）</div>
          <Input value={draft.coverUrl} onChange={(e) => onChange({ ...draft, coverUrl: e.target.value })} />
          {!isLocal ? (
            <div className="mt-2">
              <CloudUploadButton
                label="上传封面"
                accept="image/*"
                prefix="packages/cover"
                onUploaded={(ids) => onChange({ ...draft, coverUrl: ids[0] || draft.coverUrl })}
              />
            </div>
          ) : (
            <div className="mt-2 text-xs text-amber-700">本地离线模式不支持上传到云存储；切到云开发模式后可一键上传并回填。</div>
          )}
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-medium text-zinc-700">说明（可选）</div>
          <Textarea value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 text-xs font-medium text-zinc-700">交付物（可选）</div>
          <Textarea value={draft.deliverables} onChange={(e) => onChange({ ...draft, deliverables: e.target.value })} />
        </div>
      </div>

      <PackageOptionsEditor groups={draft.optionGroups} onChange={(groups) => onChange({ ...draft, optionGroups: groups })} />
    </div>
  )
}
