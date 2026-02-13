import type { Category, Package, PackageOptionGroup } from '../../../../shared/types'

export type PackageDraft = {
  id?: string
  title: string
  category: Category
  coverUrl: string
  basePrice: string
  description: string
  deliverables: string
  isPublished: boolean
  optionGroups: PackageOptionGroup[]
}

export const toPackageDraft = (p?: Package): PackageDraft =>
  p
    ? {
        id: p.id,
        title: p.title,
        category: p.category,
        coverUrl: p.coverUrl,
        basePrice: String(p.basePrice),
        description: p.description ?? '',
        deliverables: p.deliverables ?? '',
        isPublished: p.isPublished,
        optionGroups: p.optionGroups ?? [],
      }
    : {
        title: '',
        category: '写真照',
        coverUrl: '',
        basePrice: '0',
        description: '',
        deliverables: '',
        isPublished: true,
        optionGroups: [],
      }

