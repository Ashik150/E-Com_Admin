import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import HideImageOutlined from '@mui/icons-material/HideImageOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import {
  Alert, Avatar, Box, Button, Card, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, IconButton,
  InputAdornment, InputLabel, MenuItem, Pagination, Select, Snackbar, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { MediaPickerDialog } from '../components/MediaPickerDialog'
import { api, apiErrorMessage } from '../lib/api'
import { categorySlug } from '../lib/category'
import { mediaPublicUrl } from '../lib/media'
import type { ApiResponse, Brand, CategoryImage, MediaAsset, Pagination as PaginationType } from '../types/api'

export function BrandPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Brand | null | undefined>()
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['brands', page, search, status],
    queryFn: async () => (await api.get<ApiResponse<{ items: Brand[]; pagination: PaginationType }>>('/brands', { params: { page, limit: 10, search, status: status || undefined } })).data.data,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/brands/${id}`),
    onSuccess: () => { setMessage('Brand deleted'); void queryClient.invalidateQueries({ queryKey: ['brands'] }) },
    onError: (error) => setMessage(apiErrorMessage(error)),
  })

  return <Stack gap={2.5}>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap"><Box><Typography variant="h4" fontWeight={800}>Brands</Typography><Typography color="text.secondary">Manage product manufacturers and their shared Media logos.</Typography></Box>{hasPermission('brand:create') && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEditing(null)}>New brand</Button>}</Box>
    <Card>
      <Box p={2} display="flex" gap={2} flexWrap="wrap"><TextField size="small" placeholder="Search name, slug, or description" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} sx={{ minWidth: { sm: 320 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} /><FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><MenuItem value="">All statuses</MenuItem><MenuItem value="ACTIVE">Active</MenuItem><MenuItem value="INACTIVE">Inactive</MenuItem></Select></FormControl></Box>
      {query.isLoading ? <Box p={8} textAlign="center"><CircularProgress /></Box> : query.isError ? <Alert severity="error">{apiErrorMessage(query.error)}</Alert> : query.data?.items.length === 0 ? <Alert severity="info">No brands match these filters.</Alert> : <TableContainer><Table><TableHead><TableRow><TableCell>Brand</TableCell><TableCell>Slug</TableCell><TableCell>Status</TableCell><TableCell>Description</TableCell><TableCell align="right">Manage</TableCell></TableRow></TableHead><TableBody>{query.data?.items.map((brand) => <TableRow key={brand.id} hover><TableCell><Stack direction="row" alignItems="center" gap={1.5}><Avatar variant="rounded" src={mediaPublicUrl(brand.logo?.thumbnailUrl ?? brand.logo?.publicUrl ?? null)}>{brand.name.charAt(0)}</Avatar><Typography fontWeight={750}>{brand.name}</Typography></Stack></TableCell><TableCell>/{brand.slug}</TableCell><TableCell><Chip size="small" color={brand.status === 'ACTIVE' ? 'success' : 'default'} label={brand.status === 'ACTIVE' ? 'Active' : 'Inactive'} /></TableCell><TableCell sx={{ maxWidth: 320 }}><Typography variant="body2" color="text.secondary" noWrap>{brand.description || '—'}</Typography></TableCell><TableCell align="right">{hasPermission('brand:update') && <Tooltip title="Edit"><IconButton onClick={() => setEditing(brand)}><EditOutlined /></IconButton></Tooltip>}{hasPermission('brand:delete') && <Tooltip title="Delete"><IconButton color="error" onClick={() => { if (window.confirm(`Delete ${brand.name}? Brands referenced by products cannot be deleted.`)) remove.mutate(brand.id) }}><DeleteOutline /></IconButton></Tooltip>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
      {query.data && query.data.pagination.totalPages > 1 && <Box p={2} display="flex" justifyContent="center"><Pagination page={query.data.pagination.page} count={query.data.pagination.totalPages} onChange={(_event, value) => setPage(value)} /></Box>}
    </Card>
    {editing !== undefined && <BrandDialog brand={editing} canReadMedia={hasPermission('media:read')} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setMessage('Brand saved'); void queryClient.invalidateQueries({ queryKey: ['brands'] }) }} />}
    <Snackbar open={Boolean(message)} message={message} autoHideDuration={5000} onClose={() => setMessage('')} />
  </Stack>
}

function BrandDialog({ brand, canReadMedia, onClose, onSaved }: { brand: Brand | null; canReadMedia: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(brand?.name ?? '')
  const [slug, setSlug] = useState(brand?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(brand))
  const [description, setDescription] = useState(brand?.description ?? '')
  const [logo, setLogo] = useState<CategoryImage | null>(brand?.logo ?? null)
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(brand?.status ?? 'ACTIVE')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name, slug, description: description || null, logoId: logo?.id ?? null, status }
      return brand ? api.patch(`/brands/${brand.id}`, payload) : api.post('/brands', payload)
    },
    onSuccess: onSaved,
    onError: (requestError) => setError(apiErrorMessage(requestError)),
  })
  function selectLogo(asset: MediaAsset) { setLogo(asset); setPickerOpen(false) }

  return <><Dialog open fullWidth maxWidth="md" onClose={onClose}><DialogTitle>{brand ? 'Edit brand' : 'Create brand'}</DialogTitle><DialogContent><Stack gap={2.25} pt={1}>
    {error && <Alert severity="error">{error}</Alert>}
    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}><TextField label="Name" required value={name} onChange={(event) => { const value = event.target.value; setName(value); if (!slugEdited) setSlug(categorySlug(value)) }} /><TextField label="Slug" required value={slug} onChange={(event) => { setSlugEdited(true); setSlug(categorySlug(event.target.value)) }} helperText="Unique URL key." /><FormControl><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE')}><MenuItem value="ACTIVE">Active</MenuItem><MenuItem value="INACTIVE">Inactive</MenuItem></Select></FormControl></Box>
    <TextField label="Description" value={description} multiline minRows={3} inputProps={{ maxLength: 2000 }} onChange={(event) => setDescription(event.target.value)} />
    <Box border={1} borderColor="divider" borderRadius={2} p={2}><Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={2}>{logo ? <Avatar variant="rounded" src={mediaPublicUrl(logo.thumbnailUrl ?? logo.publicUrl)} alt={logo.altText || logo.fileName} sx={{ width: 84, height: 84 }} /> : <Avatar variant="rounded" sx={{ width: 84, height: 84 }}><HideImageOutlined /></Avatar>}<Box flex={1}><Typography fontWeight={700}>{logo?.title || logo?.fileName || 'No brand logo'}</Typography><Typography variant="body2" color="text.secondary">Select an existing shared image.</Typography></Box><Stack direction="row" gap={1}>{logo && <Button color="inherit" onClick={() => setLogo(null)}>Remove</Button>}<Button variant="outlined" disabled={!canReadMedia} onClick={() => setPickerOpen(true)}>Choose logo</Button></Stack></Stack>{!canReadMedia && <Alert severity="info" sx={{ mt: 2 }}>The media:read permission is required to choose a logo.</Alert>}</Box>
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={name.trim().length < 2 || slug.length < 2 || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save brand'}</Button></DialogActions></Dialog><MediaPickerDialog open={pickerOpen} selectedId={logo?.id ?? null} onClose={() => setPickerOpen(false)} onSelect={selectLogo} /></>
}
