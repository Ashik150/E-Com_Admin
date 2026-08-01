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
