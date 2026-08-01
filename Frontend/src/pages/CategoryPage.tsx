import AddOutlined from '@mui/icons-material/AddOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import HideImageOutlined from '@mui/icons-material/HideImageOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import {
  Alert, Avatar, Box, Button, Card, Chip, CircularProgress, Collapse, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel,
  IconButton, InputAdornment, InputLabel, MenuItem, Select, Snackbar, Stack,
  Switch, TextField, Tooltip, Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { MediaPickerDialog } from '../components/MediaPickerDialog'
import { api, apiErrorMessage } from '../lib/api'
import { categoryBranchIds, categorySlug, flattenCategoryTree } from '../lib/category'
import { mediaPublicUrl } from '../lib/media'
import type { ApiResponse, CategoryImage, CategoryNode, MediaAsset } from '../types/api'

export function CategoryPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<CategoryNode | null | undefined>()
  const [message, setMessage] = useState('')
  const tree = useQuery({
    queryKey: ['categories-tree', search, status],
    queryFn: async () => (await api.get<ApiResponse<{ items: CategoryNode[]; matchCount: number }>>('/categories/tree', { params: { search, active: status || undefined } })).data.data,
  })
  const allTree = useQuery({
    queryKey: ['categories-tree-all'],
    queryFn: async () => (await api.get<ApiResponse<{ items: CategoryNode[] }>>('/categories/tree')).data.data.items,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      setMessage('Category deleted')
      void queryClient.invalidateQueries({ queryKey: ['categories-tree'] })
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  })

  return <Stack gap={2.5}>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap"><Box><Typography variant="h4" fontWeight={800}>Categories</Typography><Typography color="text.secondary">Manage the ordered catalog hierarchy and its media.</Typography></Box>{hasPermission('category:create') && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEditing(null)}>New category</Button>}</Box>
    <Card>
      <Box p={2} display="flex" gap={2} flexWrap="wrap"><TextField size="small" placeholder="Search name, slug, or description" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: { sm: 320 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} /><FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><MenuItem value="">All statuses</MenuItem><MenuItem value="true">Active</MenuItem><MenuItem value="false">Inactive</MenuItem></Select></FormControl></Box>
      {tree.isLoading ? <Box p={8} textAlign="center"><CircularProgress /></Box> : tree.isError ? <Alert severity="error">{apiErrorMessage(tree.error)}</Alert> : tree.data?.items.length === 0 ? <Alert severity="info">No categories match these filters.</Alert> : <Stack px={2} pb={2} gap={1}>{tree.data?.items.map((category) => <CategoryTreeItem key={category.id} category={category} depth={0} canEdit={hasPermission('category:update')} canDelete={hasPermission('category:delete')} onEdit={setEditing} onDelete={(item) => { if (window.confirm(`Delete ${item.name}? Categories with children must be reassigned first.`)) remove.mutate(item.id) }} />)}</Stack>}
    </Card>
    {editing !== undefined && <CategoryDialog category={editing} tree={allTree.data ?? []} canReadMedia={hasPermission('media:read')} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setMessage('Category saved'); void queryClient.invalidateQueries({ queryKey: ['categories-tree'] }) }} />}
    <Snackbar open={Boolean(message)} message={message} autoHideDuration={5000} onClose={() => setMessage('')} />
  </Stack>
}

function CategoryTreeItem({ category, depth, canEdit, canDelete, onEdit, onDelete }: { category: CategoryNode; depth: number; canEdit: boolean; canDelete: boolean; onEdit: (category: CategoryNode) => void; onDelete: (category: CategoryNode) => void }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = category.children.length > 0
  return <Box>
    <Box display="flex" alignItems="center" gap={1.25} py={1.25} px={1.5} ml={{ xs: Math.min(depth, 3) * 1.5, md: Math.min(depth, 8) * 3 }} border={1} borderColor="divider" borderRadius={2} bgcolor="background.paper">
      <IconButton size="small" disabled={!hasChildren} onClick={() => setExpanded((current) => !current)}>{hasChildren ? expanded ? <ExpandMoreOutlined /> : <ChevronRightOutlined /> : <Box width={24} />}</IconButton>
      <Avatar variant="rounded" src={mediaPublicUrl(category.image?.thumbnailUrl ?? category.image?.publicUrl ?? null)}>{category.name.charAt(0)}</Avatar>
      <Box minWidth={0} flex={1}><Typography fontWeight={750} noWrap>{category.name}</Typography><Typography variant="caption" color="text.secondary" noWrap>/{category.slug} · order {category.sortOrder}</Typography></Box>
      <Chip size="small" color={category.active ? 'success' : 'default'} label={category.active ? 'Active' : 'Inactive'} />
      {canEdit && <Tooltip title="Edit"><IconButton onClick={() => onEdit(category)}><EditOutlined /></IconButton></Tooltip>}
      {canDelete && <Tooltip title={hasChildren ? 'Reassign or delete child categories first' : 'Delete'}><span><IconButton color="error" disabled={hasChildren} onClick={() => onDelete(category)}><DeleteOutline /></IconButton></span></Tooltip>}
    </Box>
    {hasChildren && <Collapse in={expanded}><Stack mt={1} gap={1}>{category.children.map((child) => <CategoryTreeItem key={child.id} category={child} depth={depth + 1} canEdit={canEdit} canDelete={canDelete} onEdit={onEdit} onDelete={onDelete} />)}</Stack></Collapse>}
  </Box>
}

function CategoryDialog({ category, tree, canReadMedia, onClose, onSaved }: { category: CategoryNode | null; tree: CategoryNode[]; canReadMedia: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(category))
  const [description, setDescription] = useState(category?.description ?? '')
  const [parentId, setParentId] = useState(category?.parentId ?? '')
  const [image, setImage] = useState<CategoryImage | null>(category?.image ?? null)
  const [active, setActive] = useState(category?.active ?? true)
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const excluded = category ? categoryBranchIds(tree, category.id) : new Set<string>()
  const parentOptions = flattenCategoryTree(tree, excluded)
  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name, slug, description: description || null, parentId: parentId || null, imageId: image?.id ?? null, active, sortOrder }
      return category ? api.patch(`/categories/${category.id}`, payload) : api.post('/categories', payload)
    },
    onSuccess: onSaved,
    onError: (requestError) => setError(apiErrorMessage(requestError)),
  })
  function selectImage(asset: MediaAsset) {
    setImage(asset)
    setPickerOpen(false)
  }

  return <><Dialog open fullWidth maxWidth="md" onClose={onClose}><DialogTitle>{category ? 'Edit category' : 'Create category'}</DialogTitle><DialogContent><Stack gap={2.25} pt={1}>
    {error && <Alert severity="error">{error}</Alert>}
    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
      <TextField label="Name" required value={name} onChange={(event) => { const value = event.target.value; setName(value); if (!slugEdited) setSlug(categorySlug(value)) }} />
      <TextField label="Slug" required value={slug} onChange={(event) => { setSlugEdited(true); setSlug(categorySlug(event.target.value)) }} helperText="Unique URL key; lowercase letters, numbers, and hyphens." />
      <FormControl><InputLabel>Parent category</InputLabel><Select label="Parent category" value={parentId} onChange={(event) => setParentId(event.target.value)}><MenuItem value="">No parent (root)</MenuItem>{parentOptions.map((option) => <MenuItem key={option.id} value={option.id}>{'— '.repeat(option.depth)}{option.label}</MenuItem>)}</Select></FormControl>
      <TextField label="Sort order" type="number" value={sortOrder} inputProps={{ min: 0, step: 1 }} onChange={(event) => setSortOrder(Math.max(0, Number(event.target.value) || 0))} />
    </Box>
    <TextField label="Description" value={description} multiline minRows={3} inputProps={{ maxLength: 2000 }} onChange={(event) => setDescription(event.target.value)} />
    <Box border={1} borderColor="divider" borderRadius={2} p={2}><Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={2}>{image ? <Avatar variant="rounded" src={mediaPublicUrl(image.thumbnailUrl ?? image.publicUrl)} alt={image.altText || image.fileName} sx={{ width: 84, height: 84 }} /> : <Avatar variant="rounded" sx={{ width: 84, height: 84 }}><HideImageOutlined /></Avatar>}<Box flex={1}><Typography fontWeight={700}>{image?.title || image?.fileName || 'No category image'}</Typography><Typography variant="body2" color="text.secondary">Choose an existing shared image from the Media library.</Typography></Box><Stack direction="row" gap={1}>{image && <Button color="inherit" onClick={() => setImage(null)}>Remove</Button>}<Button variant="outlined" disabled={!canReadMedia} onClick={() => setPickerOpen(true)}>Choose image</Button></Stack></Stack>{!canReadMedia && <Alert severity="info" sx={{ mt: 2 }}>The media:read permission is required to choose an image.</Alert>}</Box>
    <FormControlLabel control={<Switch checked={active} onChange={(_event, checked) => setActive(checked)} />} label={active ? 'Active category' : 'Inactive category'} />
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={name.trim().length < 2 || slug.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save category'}</Button></DialogActions></Dialog>
  <MediaPickerDialog open={pickerOpen} selectedId={image?.id ?? null} onClose={() => setPickerOpen(false)} onSelect={selectImage} /></>
}
