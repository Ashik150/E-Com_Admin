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
import { attributeReferenceKind, attributeTypeLabels, attributeTypes } from '../lib/attribute'
import type { ApiResponse, Attribute, AttributeType, AttributeValue, CategoryImage, MediaAsset, Pagination as PaginationType } from '../types/api'

export function AttributePage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [editing, setEditing] = useState<Attribute | null | undefined>()
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['attributes', page, search, type],
    queryFn: async () => (await api.get<ApiResponse<{ items: Attribute[]; pagination: PaginationType }>>('/attributes', { params: { page, limit: 10, search, type: type || undefined } })).data.data,
  })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/attributes/${id}`), onSuccess: () => { setMessage('Attribute deleted'); void queryClient.invalidateQueries({ queryKey: ['attributes'] }) }, onError: (error) => setMessage(apiErrorMessage(error)) })

  async function edit(attribute: Attribute) {
    try { setEditing((await api.get<ApiResponse<Attribute>>(`/attributes/${attribute.id}`)).data.data) }
    catch (error) { setMessage(apiErrorMessage(error)) }
  }

  return <Stack gap={2.5}>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap"><Box><Typography variant="h4" fontWeight={800}>Attributes</Typography><Typography color="text.secondary">Define variant dimensions and their selectable values.</Typography></Box>{hasPermission('attribute:create') && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEditing(null)}>New attribute</Button>}</Box>
    <Card>
      <Box p={2} display="flex" gap={2} flexWrap="wrap"><TextField size="small" placeholder="Search name or slug" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} sx={{ minWidth: { sm: 300 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} /><FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Type</InputLabel><Select label="Type" value={type} onChange={(event) => { setType(event.target.value); setPage(1) }}><MenuItem value="">All types</MenuItem>{attributeTypes.map((item) => <MenuItem key={item} value={item}>{attributeTypeLabels[item]}</MenuItem>)}</Select></FormControl></Box>
      {query.isLoading ? <Box p={8} textAlign="center"><CircularProgress /></Box> : query.isError ? <Alert severity="error">{apiErrorMessage(query.error)}</Alert> : query.data?.items.length === 0 ? <Alert severity="info">No attributes match these filters.</Alert> : <TableContainer><Table><TableHead><TableRow><TableCell>Attribute</TableCell><TableCell>Type</TableCell><TableCell>Values</TableCell><TableCell align="right">Manage</TableCell></TableRow></TableHead><TableBody>{query.data?.items.map((attribute) => <TableRow key={attribute.id} hover><TableCell><Typography fontWeight={750}>{attribute.name}</Typography><Typography variant="caption" color="text.secondary">/{attribute.slug}</Typography></TableCell><TableCell><Chip size="small" label={attributeTypeLabels[attribute.type]} /></TableCell><TableCell>{attribute.valueCount ?? 0}</TableCell><TableCell align="right">{hasPermission('attribute:update') && <Tooltip title="Edit details and values"><IconButton onClick={() => void edit(attribute)}><EditOutlined /></IconButton></Tooltip>}{hasPermission('attribute:delete') && <Tooltip title="Delete"><IconButton color="error" onClick={() => { if (window.confirm(`Delete ${attribute.name} and its unused values? Values used by variants cannot be deleted.`)) remove.mutate(attribute.id) }}><DeleteOutline /></IconButton></Tooltip>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
      {query.data && query.data.pagination.totalPages > 1 && <Box p={2} display="flex" justifyContent="center"><Pagination page={query.data.pagination.page} count={query.data.pagination.totalPages} onChange={(_event, value) => setPage(value)} /></Box>}
    </Card>
    {editing !== undefined && <AttributeEditor key={editing?.id ?? 'new'} attribute={editing} canUpdate={hasPermission('attribute:update')} canReadMedia={hasPermission('media:read')} onChanged={(attribute) => { setEditing(attribute); void queryClient.invalidateQueries({ queryKey: ['attributes'] }) }} onClose={() => { setEditing(undefined); void queryClient.invalidateQueries({ queryKey: ['attributes'] }) }} onMessage={setMessage} />}
    <Snackbar open={Boolean(message)} message={message} autoHideDuration={5000} onClose={() => setMessage('')} />
  </Stack>
}

function AttributeEditor({ attribute, canUpdate, canReadMedia, onChanged, onClose, onMessage }: { attribute: Attribute | null; canUpdate: boolean; canReadMedia: boolean; onChanged: (attribute: Attribute) => void; onClose: () => void; onMessage: (message: string) => void }) {
  const [current, setCurrent] = useState(attribute)
  const [name, setName] = useState(attribute?.name ?? '')
  const [slug, setSlug] = useState(attribute?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(attribute))
  const [type, setType] = useState<AttributeType>(attribute?.type ?? 'DROPDOWN')
  const [editingValue, setEditingValue] = useState<AttributeValue | null | undefined>()
  const [error, setError] = useState('')
  const details = useMutation({
    mutationFn: async () => (current ? api.patch<ApiResponse<Attribute>>(`/attributes/${current.id}`, { name, slug, type }) : api.post<ApiResponse<Attribute>>('/attributes', { name, slug, type })),
    onSuccess: (response) => { const saved = response.data.data; setCurrent(saved); onChanged(saved); onMessage(current ? 'Attribute details saved' : 'Attribute created; you can now add values') },
    onError: (requestError) => setError(apiErrorMessage(requestError)),
  })
  const removeValue = useMutation({
    mutationFn: (valueId: string) => api.delete<ApiResponse<Attribute>>(`/attributes/${current!.id}/values/${valueId}`),
    onSuccess: (response) => { setCurrent(response.data.data); onChanged(response.data.data); onMessage('Attribute value deleted') },
    onError: (requestError) => setError(apiErrorMessage(requestError)),
  })
  function changed(updated: Attribute) { setCurrent(updated); onChanged(updated); setEditingValue(undefined); onMessage('Attribute value saved') }

  return <><Dialog open fullWidth maxWidth="md" onClose={onClose}><DialogTitle>{current ? `Manage ${current.name}` : 'Create attribute'}</DialogTitle><DialogContent><Stack gap={2.5} pt={1}>
    {error && <Alert severity="error">{error}</Alert>}
    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr 1fr' }} gap={2}><TextField label="Name" required value={name} onChange={(event) => { const value = event.target.value; setName(value); if (!slugEdited) setSlug(categorySlug(value)) }} /><TextField label="Slug" required value={slug} onChange={(event) => { setSlugEdited(true); setSlug(categorySlug(event.target.value)) }} /><FormControl disabled={Boolean(current?.values?.length)}><InputLabel>Type</InputLabel><Select label="Type" value={type} onChange={(event) => setType(event.target.value as AttributeType)}>{attributeTypes.map((item) => <MenuItem key={item} value={item}>{attributeTypeLabels[item]}</MenuItem>)}</Select></FormControl></Box>
    {Boolean(current?.values?.length) && <Typography variant="caption" color="text.secondary">Remove all values before changing the attribute type.</Typography>}
    <Box display="flex" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" fontWeight={750}>Values</Typography><Typography variant="body2" color="text.secondary">Values are unique inside this attribute.</Typography></Box>{current && canUpdate && <Button startIcon={<AddOutlined />} onClick={() => setEditingValue(null)}>Add value</Button>}</Box>
    {!current ? <Alert severity="info">Save the attribute details before adding values.</Alert> : current.values?.length === 0 ? <Alert severity="info">No values yet.</Alert> : <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}><Table size="small"><TableHead><TableRow><TableCell>Value</TableCell><TableCell>Reference</TableCell><TableCell>Order</TableCell><TableCell align="right">Manage</TableCell></TableRow></TableHead><TableBody>{current.values?.map((value) => <TableRow key={value.id}><TableCell><Typography fontWeight={700}>{value.value}</Typography><Typography variant="caption" color="text.secondary">/{value.slug}</Typography></TableCell><TableCell>{value.colorValue ? <Stack direction="row" alignItems="center" gap={1}><Box width={24} height={24} borderRadius="50%" border={1} borderColor="divider" bgcolor={value.colorValue} />{value.colorValue}</Stack> : value.image ? <Stack direction="row" alignItems="center" gap={1}><Avatar variant="rounded" src={mediaPublicUrl(value.image.thumbnailUrl ?? value.image.publicUrl)} sx={{ width: 32, height: 32 }} />{value.image.title || value.image.fileName}</Stack> : '—'}</TableCell><TableCell>{value.sortOrder}</TableCell><TableCell align="right">{canUpdate && <><Tooltip title="Edit value"><IconButton onClick={() => setEditingValue(value)}><EditOutlined /></IconButton></Tooltip><Tooltip title="Delete value"><IconButton color="error" onClick={() => { if (window.confirm(`Delete ${value.value}? Values used by variants cannot be deleted.`)) removeValue.mutate(value.id) }}><DeleteOutline /></IconButton></Tooltip></>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Close</Button><Button variant="contained" disabled={name.trim().length < 2 || slug.length < 2 || details.isPending || (Boolean(current) && !canUpdate)} onClick={() => details.mutate()}>{details.isPending ? 'Saving…' : current ? 'Save details' : 'Create attribute'}</Button></DialogActions></Dialog>
  {current && editingValue !== undefined && <AttributeValueDialog attribute={current} value={editingValue} canReadMedia={canReadMedia} onClose={() => setEditingValue(undefined)} onSaved={changed} />}</>
}

function AttributeValueDialog({ attribute, value, canReadMedia, onClose, onSaved }: { attribute: Attribute; value: AttributeValue | null; canReadMedia: boolean; onClose: () => void; onSaved: (attribute: Attribute) => void }) {
  const [label, setLabel] = useState(value?.value ?? '')
  const [slug, setSlug] = useState(value?.slug ?? '')
  const [slugEdited, setSlugEdited] = useState(Boolean(value))
  const [colorValue, setColorValue] = useState(value?.colorValue ?? '#000000')
  const [image, setImage] = useState<CategoryImage | null>(value?.image ?? null)
  const [sortOrder, setSortOrder] = useState(value?.sortOrder ?? 0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { value: label, slug, sortOrder, colorValue: attribute.type === 'COLOR_SWATCH' ? colorValue : null, imageId: attribute.type === 'IMAGE_SWATCH' ? image?.id ?? null : null }
      return value ? api.patch<ApiResponse<Attribute>>(`/attributes/${attribute.id}/values/${value.id}`, payload) : api.post<ApiResponse<Attribute>>(`/attributes/${attribute.id}/values`, payload)
    },
    onSuccess: (response) => onSaved(response.data.data),
    onError: (requestError) => setError(apiErrorMessage(requestError)),
  })
  function selectImage(asset: MediaAsset) { setImage(asset); setPickerOpen(false) }
  const referenceKind = attributeReferenceKind(attribute.type)
  const referenceValid = referenceKind !== 'image' || Boolean(image)

  return <><Dialog open fullWidth maxWidth="sm" onClose={onClose}><DialogTitle>{value ? 'Edit value' : `Add ${attribute.name} value`}</DialogTitle><DialogContent><Stack gap={2} pt={1}>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField label="Value" required value={label} onChange={(event) => { const next = event.target.value; setLabel(next); if (!slugEdited) setSlug(categorySlug(next)) }} />
    <TextField label="Slug" required value={slug} onChange={(event) => { setSlugEdited(true); setSlug(categorySlug(event.target.value)) }} />
    <TextField label="Sort order" type="number" value={sortOrder} inputProps={{ min: 0 }} onChange={(event) => setSortOrder(Math.max(0, Number(event.target.value) || 0))} />
    {referenceKind === 'colour' && <TextField label="Colour reference" type="color" value={colorValue} onChange={(event) => setColorValue(event.target.value.toUpperCase())} helperText={colorValue.toUpperCase()} />}
    {referenceKind === 'image' && <Box border={1} borderColor="divider" borderRadius={2} p={2}><Stack direction="row" alignItems="center" gap={2}>{image ? <Avatar variant="rounded" src={mediaPublicUrl(image.thumbnailUrl ?? image.publicUrl)} sx={{ width: 72, height: 72 }} /> : <Avatar variant="rounded" sx={{ width: 72, height: 72 }}><HideImageOutlined /></Avatar>}<Box flex={1}><Typography fontWeight={700}>{image?.title || image?.fileName || 'No swatch image'}</Typography></Box><Button variant="outlined" disabled={!canReadMedia} onClick={() => setPickerOpen(true)}>Choose image</Button></Stack>{!canReadMedia && <Alert severity="info" sx={{ mt: 2 }}>The media:read permission is required.</Alert>}</Box>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!label.trim() || !slug || !referenceValid || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save value'}</Button></DialogActions></Dialog><MediaPickerDialog open={pickerOpen} selectedId={image?.id ?? null} onClose={() => setPickerOpen(false)} onSelect={selectImage} /></>
}
