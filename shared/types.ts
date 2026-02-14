export type Category = '毕业照' | '写真照' | '婚纱照' | '场地租赁'

export type ItemType = 'work' | 'package'

export type PriceOp = 'replace' | 'add' | 'minus'

export type PackageOptionItem = {
  id: string
  name: string
  description?: string
  qty?: string
  op: PriceOp
  deltaPrice: number
  maxQty?: number
  assetUrls?: string[]
}

export type PackageOptionGroup = {
  id: string
  name: string
  op: PriceOp
  required: boolean
  selectMode: 'single' | 'multi'
  items: PackageOptionItem[]
}

export type PackageIncludeItem = {
  id: string
  name: string
  description?: string
  qty?: string
  assetUrls?: string[]
}

export type PackageIncludeGroup = {
  id: string
  name: string
  items: PackageIncludeItem[]
}

export type Work = {
  id: string
  category: Category
  title: string
  coverUrl: string
  imageUrls: string[]
  description?: string
  isPublished: boolean
  likeCount: number
  createdAt: number
  updatedAt?: number
}

export type Package = {
  id: string
  category: Category
  title: string
  coverUrl: string
  mediaUrls?: string[]
  basePrice: number
  description?: string
  deliverables?: string
  includedGroups?: PackageIncludeGroup[]
  optionGroups: PackageOptionGroup[]
  isPublished: boolean
  likeCount: number
  createdAt: number
  updatedAt?: number
}
