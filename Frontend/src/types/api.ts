export interface ApiResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: {
    statusCode: number
    code: string
    message: string
    details?: Record<string, string[]>
    requiredPermissions?: string[]
  }
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: { id: string; name: string; status: 'ACTIVE' }
  permissions: string[]
}

export interface PermissionAction {
  id: string
  name: string
  action: string
  description: string | null
}

export interface PermissionGroup {
  id: string
  name: string
  slug: string
  description: string | null
  actions: PermissionAction[]
  createdAt: string
  updatedAt: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  status: 'ACTIVE' | 'INACTIVE'
  userCount: number
  permissionCount?: number
  permissionIds?: string[]
  permissions?: Array<{ id: string; name: string }>
}

export interface User {
  id: string
  name: string
  email: string
  phone: string | null
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null
  avatarUrl: string | null
  active: boolean
  role: { id: string; name: string; status: 'ACTIVE' | 'INACTIVE' }
  createdAt: string
  updatedAt: string
}

export interface MediaAsset {
  id: string
  fileName: string
  storedPath: string
  publicUrl: string
  mimeType: string
  type: 'IMAGE' | 'VIDEO'
  size: number
  width: number | null
  height: number | null
  thumbnailPath: string | null
  thumbnailUrl: string | null
  altText: string | null
  title: string | null
  uploadedBy: { id: string; name: string; email: string }
  createdAt: string
  updatedAt: string
}

export interface CategoryImage {
  id: string
  fileName: string
  publicUrl: string
  thumbnailUrl: string | null
  altText: string | null
  title: string | null
}

export interface CategoryNode {
  id: string
  name: string
  slug: string
  description: string | null
  imageId: string | null
  parentId: string | null
  active: boolean
  sortOrder: number
  image: CategoryImage | null
  children: CategoryNode[]
  createdAt: string
  updatedAt: string
}

export interface Brand {
  id: string
  name: string
  slug: string
  description: string | null
  logoId: string | null
  status: 'ACTIVE' | 'INACTIVE'
  logo: CategoryImage | null
  createdAt: string
  updatedAt: string
}

export type AttributeType =
  | 'DROPDOWN'
  | 'RADIO'
  | 'CHECKBOX'
  | 'COLOR_SWATCH'
  | 'IMAGE_SWATCH'

export interface AttributeValue {
  id: string
  attributeId: string
  value: string
  slug: string
  colorValue: string | null
  imageId: string | null
  sortOrder: number
  image: CategoryImage | null
  media?: ProductMediaReference[]
  createdAt: string
  updatedAt: string
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

export interface ProductMediaReference extends CategoryImage {
  type: 'IMAGE' | 'VIDEO'
}

export interface ProductListItem {
  id: string
  name: string
  slug: string
  sku: string | null
  hasVariants: boolean
  active: boolean
  featured: boolean
  brand: { id: string; name: string } | null
  categories: Array<{ id: string; name: string }>
  thumbnail: ProductMediaReference | null
  priceMin: number
  priceMax: number
  stock: number
  stockStatus: StockStatus
  createdAt: string
}

export interface ProductMediaAttachment {
  mediaId: string
  isThumbnail: boolean
  isGallery: boolean
  sortOrder: number
  asset: ProductMediaReference
}

export interface ProductVariantValue {
  id: string
  attributeId: string
  attribute: Attribute
  value: string
  slug: string
  colorValue: string | null
  image: ProductMediaReference | null
  media: ProductMediaReference[]
}

export interface ProductVariant {
  id: string
  sku: string
  price: number
  salePrice: number | null
  stock: number
  stockStatus: StockStatus
  lowStockThreshold: number
  weight: number | null
  active: boolean
  purchasable: boolean
  values: ProductVariantValue[]
  media: ProductMediaAttachment[]
}

export interface Product {
  id: string
  name: string
  slug: string
  sku: string | null
  shortDescription: string | null
  longDescription: string | null
  hasVariants: boolean
  price: number | null
  salePrice: number | null
  stock: number | null
  stockStatus: StockStatus | null
  weight: number | null
  active: boolean
  featured: boolean
  sortOrder: number
  brandId: string | null
  brand: Brand | null
  categories: CategoryNode[]
  media: ProductMediaAttachment[]
  variants: ProductVariant[]
  createdAt: string
  updatedAt: string
}

export interface ProductFormOptions {
  brands: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string; parentId: string | null }>
  attributes: Array<Attribute & { values: AttributeValue[] }>
}

export interface Attribute {
  id: string
  name: string
  slug: string
  type: AttributeType
  valueCount?: number
  values?: AttributeValue[]
  createdAt: string
  updatedAt: string
}
