export type Category = '毕业照' | '写真照' | '婚纱照' | '场地租赁'

export type ItemType = 'work' | 'package'

export type PriceOp = 'replace' | 'add' | 'minus'

export type PackageOptionItem = {
  id: string
  name: string
  op: PriceOp
  deltaPrice: number
  maxQty?: number
}

export type PackageOptionGroup = {
  id: string
  name: string
  op: PriceOp
  required: boolean
  selectMode: 'single' | 'multi'
  items: PackageOptionItem[]
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
  basePrice: number
  description?: string
  deliverables?: string
  optionGroups: PackageOptionGroup[]
  isPublished: boolean
  likeCount: number
  createdAt: number
  updatedAt?: number
}

export type BookingStatus = '待确认' | '已确认' | '已完成' | '已取消'

export type Booking = {
  id: string
  userOpenid: string
  itemType: ItemType
  itemId: string
  itemTitleSnapshot: string
  selectedOptionsSnapshot?: unknown
  priceSnapshot?: {
    base: number
    delta: number
    total: number
    lines: { name: string; delta: number }[]
  }
  contactName: string
  contactPhone: string
  contactWechat: string
  shootingType: string
  scheduledAt: string
  remark?: string
  status: BookingStatus
  adminNote?: string
  createdAt: number
  updatedAt?: number
}

