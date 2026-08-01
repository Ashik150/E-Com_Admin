import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, InputAdornment, Pagination, Stack, TextField, Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, apiErrorMessage } from '../lib/api'
import { mediaPublicUrl } from '../lib/media'
import type { ApiResponse, MediaAsset, Pagination as PaginationType } from '../types/api'

export function MediaPickerDialog({ open, selectedId, onClose, onSelect }: { open: boolean; selectedId: string | null; onClose: () => void; onSelect: (asset: MediaAsset) => void }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const query = useQuery({
    queryKey: ['media-picker', page, search],
    enabled: open,
    queryFn: async () => (await api.get<ApiResponse<{ items: MediaAsset[]; pagination: PaginationType }>>('/media', { params: { page, limit: 12, search, type: 'IMAGE' } })).data.data,
  })
  const chosenId = selected?.id ?? selectedId

  return <Dialog open={open} fullWidth maxWidth="md" onClose={onClose}>
    <DialogTitle>Choose from media library</DialogTitle>
    <DialogContent><Stack gap={2} pt={1}>
      <TextField size="small" placeholder="Search images" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} />
      {query.isLoading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : query.isError ? <Alert severity="error">{apiErrorMessage(query.error)}</Alert> : query.data?.items.length === 0 ? <Alert severity="info">No images are available. Upload one in the Media library first.</Alert> : <Box display="grid" gridTemplateColumns={{ xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' }} gap={1.5}>{query.data?.items.map((asset) => <Box key={asset.id} component="button" type="button" onClick={() => setSelected(asset)} sx={{ position: 'relative', p: 0, border: 2, borderColor: chosenId === asset.id ? 'primary.main' : 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper', cursor: 'pointer', textAlign: 'left' }}><Box component="img" src={mediaPublicUrl(asset.thumbnailUrl ?? asset.publicUrl)} alt={asset.altText || asset.fileName} sx={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} /><Typography variant="caption" display="block" noWrap p={1}>{asset.title || asset.fileName}</Typography>{chosenId === asset.id && <CheckCircleOutlined color="primary" sx={{ position: 'absolute', right: 6, top: 6, bgcolor: 'white', borderRadius: '50%' }} />}</Box>)}</Box>}
      {query.data && query.data.pagination.totalPages > 1 && <Pagination page={query.data.pagination.page} count={query.data.pagination.totalPages} onChange={(_event, value) => setPage(value)} sx={{ alignSelf: 'center' }} />}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!selected} onClick={() => { if (selected) onSelect(selected) }}>Use selected image</Button></DialogActions>
  </Dialog>
}
