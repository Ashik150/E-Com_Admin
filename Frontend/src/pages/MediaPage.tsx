import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import VideoLibraryOutlined from '@mui/icons-material/VideoLibraryOutlined'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, IconButton,
  InputAdornment, InputLabel, LinearProgress, MenuItem, Pagination, Select,
  Snackbar, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { api, apiErrorMessage } from '../lib/api'
import { formatBytes, mediaPublicUrl } from '../lib/media'
import type { ApiResponse, MediaAsset, Pagination as PaginationType } from '../types/api'

export function MediaPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [editing, setEditing] = useState<MediaAsset | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['media', page, search, type],
    queryFn: async () => (await api.get<ApiResponse<{ items: MediaAsset[]; pagination: PaginationType }>>('/media', { params: { page, limit: 12, search, type: type || undefined } })).data.data,
  })
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      return api.post('/media/upload', formData, {
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100))
        },
      })
    },
    onSuccess: (_response, files) => {
      setMessage(`${files.length} file${files.length === 1 ? '' : 's'} uploaded`)
      setUploadProgress(null)
      void queryClient.invalidateQueries({ queryKey: ['media'] })
    },
    onError: (error) => {
      setMessage(apiErrorMessage(error))
      setUploadProgress(null)
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/media/${id}`),
    onSuccess: () => {
      setMessage('Asset deleted')
      void queryClient.invalidateQueries({ queryKey: ['media'] })
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  })

  function selectFiles(files: FileList | null) {
    const selected = files ? Array.from(files) : []
    if (selected.length > 0) {
      setUploadProgress(0)
      upload.mutate(selected)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  return <Stack gap={2.5}>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
      <Box><Typography variant="h4" fontWeight={800}>Media library</Typography><Typography color="text.secondary">Upload once and reuse assets across the catalog.</Typography></Box>
      {hasPermission('media:upload') && <><input ref={fileInput} hidden type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm" onChange={(event) => selectFiles(event.target.files)} /><Button variant="contained" startIcon={<CloudUploadOutlined />} disabled={upload.isPending} onClick={() => fileInput.current?.click()}>{upload.isPending ? 'Uploading…' : 'Upload files'}</Button></>}
    </Box>
    {uploadProgress !== null && <Card><CardContent><Stack gap={1}><Box display="flex" justifyContent="space-between"><Typography fontWeight={700}>Uploading and validating files</Typography><Typography>{uploadProgress}%</Typography></Box><LinearProgress variant="determinate" value={uploadProgress} /><Typography variant="caption" color="text.secondary">Files are signature-checked and image thumbnails are generated after transfer.</Typography></Stack></CardContent></Card>}
    <Card>
      <Box p={2} display="flex" gap={2} flexWrap="wrap">
        <TextField size="small" placeholder="Search filename, title, or alt text" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} sx={{ minWidth: { sm: 320 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} />
        <FormControl size="small" sx={{ minWidth: 160 }}><InputLabel>Type</InputLabel><Select label="Type" value={type} onChange={(event) => { setType(event.target.value); setPage(1) }}><MenuItem value="">All types</MenuItem><MenuItem value="IMAGE">Images</MenuItem><MenuItem value="VIDEO">Videos</MenuItem></Select></FormControl>
      </Box>
      {query.isLoading ? <Box p={8} textAlign="center"><CircularProgress /></Box> : query.isError ? <Alert severity="error">{apiErrorMessage(query.error)}</Alert> : query.data?.items.length === 0 ? <Alert severity="info">No media assets match these filters.</Alert> : <Box p={2} pt={0} display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }} gap={2}>{query.data?.items.map((asset) => <MediaCard key={asset.id} asset={asset} canEdit={hasPermission('media:write')} canDelete={hasPermission('media:delete')} onEdit={() => setEditing(asset)} onDelete={() => { if (window.confirm(`Delete ${asset.fileName}? The stored file and its thumbnail will be removed.`)) remove.mutate(asset.id) }} />)}</Box>}
      {query.data && query.data.pagination.totalPages > 1 && <Box p={2} display="flex" justifyContent="center"><Pagination page={query.data.pagination.page} count={query.data.pagination.totalPages} onChange={(_event, value) => setPage(value)} /></Box>}
    </Card>
    {editing && <MediaEditDialog asset={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage('Media metadata saved'); void queryClient.invalidateQueries({ queryKey: ['media'] }) }} />}
    <Snackbar open={Boolean(message)} message={message} autoHideDuration={5000} onClose={() => setMessage('')} />
  </Stack>
}

function MediaCard({ asset, canEdit, canDelete, onEdit, onDelete }: { asset: MediaAsset; canEdit: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void }) {
  const preview = mediaPublicUrl(asset.thumbnailUrl ?? asset.publicUrl)
  return <Card sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    <Box height={190} bgcolor="grey.100" display="grid" sx={{ placeItems: 'center' }} overflow="hidden">
      {asset.type === 'IMAGE' ? <Box component="img" src={preview} alt={asset.altText || asset.title || asset.fileName} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Stack alignItems="center" color="text.secondary"><VideoLibraryOutlined sx={{ fontSize: 58 }} /><Typography variant="caption">Video preview</Typography></Stack>}
    </Box>
    <CardContent sx={{ flex: 1 }}><Stack gap={1}>
      <Tooltip title={asset.fileName}><Typography fontWeight={750} noWrap>{asset.title || asset.fileName}</Typography></Tooltip>
      {asset.title && <Typography variant="caption" color="text.secondary" noWrap>{asset.fileName}</Typography>}
      <Stack direction="row" gap={1} flexWrap="wrap"><Chip size="small" icon={asset.type === 'IMAGE' ? <ImageOutlined /> : <VideoLibraryOutlined />} label={asset.type.toLowerCase()} /><Chip size="small" variant="outlined" label={formatBytes(asset.size)} />{asset.width && asset.height && <Chip size="small" variant="outlined" label={`${asset.width}×${asset.height}`} />}</Stack>
      <Typography variant="caption" color="text.secondary">Uploaded by {asset.uploadedBy.name}</Typography>
    </Stack></CardContent>
    {(canEdit || canDelete) && <Box px={1.5} pb={1.5} display="flex" justifyContent="flex-end">{canEdit && <Tooltip title="Edit metadata"><IconButton onClick={onEdit}><EditOutlined /></IconButton></Tooltip>}{canDelete && <Tooltip title="Delete asset"><IconButton color="error" onClick={onDelete}><DeleteOutline /></IconButton></Tooltip>}</Box>}
  </Card>
}

function MediaEditDialog({ asset, onClose, onSaved }: { asset: MediaAsset; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(asset.title ?? '')
  const [altText, setAltText] = useState(asset.altText ?? '')
  const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: () => api.patch(`/media/${asset.id}`, { title: title || null, altText: altText || null }), onSuccess: onSaved, onError: (requestError) => setError(apiErrorMessage(requestError)) })
  return <Dialog open fullWidth maxWidth="sm" onClose={onClose}><DialogTitle>Edit media metadata</DialogTitle><DialogContent><Stack gap={2} pt={1}>
    {error && <Alert severity="error">{error}</Alert>}
    {asset.type === 'IMAGE' && <Box component="img" src={mediaPublicUrl(asset.thumbnailUrl ?? asset.publicUrl)} alt={altText || asset.fileName} sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', bgcolor: 'grey.100', borderRadius: 2 }} />}
    <Typography variant="body2" color="text.secondary">{asset.fileName} · {asset.mimeType} · {formatBytes(asset.size)}</Typography>
    <TextField label="Title" value={title} inputProps={{ maxLength: 160 }} onChange={(event) => setTitle(event.target.value)} helperText={`${title.length}/160`} />
    <TextField label="Alt text" value={altText} inputProps={{ maxLength: 500 }} onChange={(event) => setAltText(event.target.value)} multiline minRows={3} helperText="Describe the image for accessibility and fallback display." />
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save metadata'}</Button></DialogActions></Dialog>
}
