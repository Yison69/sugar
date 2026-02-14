import type { Category, Package, PackageIncludeGroup, PackageOptionGroup } from '../../../../shared/types'

export type PackageDraft = {
  id?: string
  title: string
  category: Category
  coverUrl: string
  mediaUrls: string[]
  basePrice: string
  description: string
  deliverables: string
  isPublished: boolean
  includedGroups: PackageIncludeGroup[]
  optionGroups: PackageOptionGroup[]
}

export const toPackageDraft = (p?: Package): PackageDraft =>
  p
    ? {
        id: p.id,
        title: p.title,
        category: p.category,
        coverUrl: p.coverUrl,
        mediaUrls: Array.isArray(p.mediaUrls) ? p.mediaUrls : [],
        basePrice: String(p.basePrice),
        description: p.description ?? '',
        deliverables: p.deliverables ?? '',
        isPublished: p.isPublished,
        includedGroups: (p.includedGroups ?? []).map((g) => ({
          ...g,
          items: (g.items || []).map((it) => ({
            ...it,
            description: it.description ?? '',
            assetUrls: Array.isArray(it.assetUrls) ? it.assetUrls : [],
          })),
        })),
        optionGroups: (p.optionGroups ?? []).map((g) => ({
          ...g,
          items: (g.items || []).map((it) => ({
            ...it,
            description: it.description ?? '',
            assetUrls: Array.isArray(it.assetUrls) ? it.assetUrls : [],
          })),
        })),
      }
    : {
        title: '',
        category: '写真照',
        coverUrl: '',
        mediaUrls: [],
        basePrice: '0',
        description: '',
        deliverables: '',
        isPublished: true,
        includedGroups: [],
        optionGroups: [],
      }
