import type { PackageOptionItem } from '../../../../shared/types'
import MediaUrlListEditor from '@/components/admin/MediaUrlListEditor'

export default function OptionAssetsEditor({
  item,
  onChange,
}: {
  item: PackageOptionItem
  onChange: (patch: Partial<PackageOptionItem>) => void
}) {
  const urls = Array.isArray(item.assetUrls) ? item.assetUrls : []
  return (
    <MediaUrlListEditor
      title="该选项资源"
      description="图片/视频上传后，小程序会随选项展示"
      urls={urls}
      accept="image/*,video/*"
      prefix={`options/${item.id}`}
      multiple
      onChange={(next) => onChange({ assetUrls: next })}
    />
  )
}

