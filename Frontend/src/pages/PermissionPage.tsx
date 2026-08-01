import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Pagination,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { api, apiErrorMessage } from '../lib/api'
import type { ApiResponse, Pagination as PaginationType, PermissionGroup } from '../types/api'

const standardActions = ['watch', 'create', 'read', 'update', 'delete', 'upload', 'write', 'approve', 'status']

export function PermissionPage() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<PermissionGroup | null | undefined>()
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['permissions', page, search],
    queryFn: async () => (await api.get<ApiResponse<{ items: PermissionGroup[]; pagination: PaginationType }>>('/permissions', { params: { page, limit: 10, search } })).data.data,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/permissions/${id}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['permissions'] }); setMessage('Permission group deleted') },
    onError: (error) => setMessage(apiErrorMessage(error)),
  })

  return (
    <Stack gap={2.5}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
        <Box><Typography variant="h4" fontWeight={800}>Permissions</Typography><Typography color="text.secondary">Capabilities grouped by module and action.</Typography></Box>
        {hasPermission('permission:create') && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEditing(null)}>New group</Button>}
      </Box>
      <Card>
        <Box p={2}><TextField size="small" placeholder="Search modules or permissions" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} /></Box>
        {query.isLoading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : query.isError ? <Alert severity="error">{apiErrorMessage(query.error)}</Alert> : query.data?.items.length === 0 ? <Alert severity="info">No permission groups found.</Alert> : (
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell>Module</TableCell><TableCell>Description</TableCell><TableCell>Actions</TableCell><TableCell align="right">Manage</TableCell></TableRow></TableHead>
              <TableBody>{query.data?.items.map((group) => (
                <TableRow key={group.id} hover>
                  <TableCell><Typography fontWeight={700}>{group.name}</Typography><Typography variant="caption" color="text.secondary">{group.slug}</Typography></TableCell>
                  <TableCell>{group.description || '—'}</TableCell>
                  <TableCell><Stack direction="row" gap={.75} flexWrap="wrap">{group.actions.map((action) => <Chip key={action.id} label={action.action} size="small" />)}</Stack></TableCell>
                  <TableCell align="right">
                    {hasPermission('permission:update') && <Tooltip title="Edit"><IconButton onClick={() => setEditing(group)}><EditOutlined /></IconButton></Tooltip>}
                    {hasPermission('permission:delete') && <Tooltip title="Delete"><IconButton color="error" onClick={() => { if (window.confirm(`Delete ${group.name}? Role links to its permissions will also be removed.`)) remove.mutate(group.id) }}><DeleteOutline /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </TableContainer>
        )}
        {query.data && <Box p={2} display="flex" justifyContent="center"><Pagination page={query.data.pagination.page} count={query.data.pagination.totalPages} onChange={(_event, value) => setPage(value)} /></Box>}
      </Card>
      {editing !== undefined && <PermissionDialog group={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setMessage('Permission group saved'); void queryClient.invalidateQueries({ queryKey: ['permissions'] }) }} />}
      <Snackbar open={Boolean(message)} autoHideDuration={4000} onClose={() => setMessage('')} message={message} />
    </Stack>
  )
}

function PermissionDialog({ group, onClose, onSaved }: { group: PermissionGroup | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [selected, setSelected] = useState<string[]>(group?.actions.map((item) => item.action) ?? ['watch', 'read'])
  const [custom, setCustom] = useState(group?.actions.map((item) => item.action).filter((action) => !standardActions.includes(action)).join(', ') ?? '')
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: () => {
      const customActions = custom.split(',').map((action) => action.trim().toLowerCase()).filter(Boolean)
      const actions = [...new Set([...selected.filter((action) => standardActions.includes(action)), ...customActions])]
      return group ? api.patch(`/permissions/${group.id}`, { name, description, actions }) : api.post('/permissions', { name, description, actions })
    },
    onSuccess: onSaved,
    onError: (requestError) => setError(apiErrorMessage(requestError)),
  })

  useEffect(() => {
    if (!group) return
    setSelected(group.actions.map((item) => item.action))
  }, [group])

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose}>
      <DialogTitle>{group ? 'Edit permission group' : 'Create permission group'}</DialogTitle>
      <DialogContent><Stack gap={2.5} pt={1}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Module name" required value={name} onChange={(event) => setName(event.target.value)} helperText="Names are normalized into lowercase permission prefixes." />
        <TextField label="Description" multiline minRows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        <Box><Typography fontWeight={700} mb={1}>Standard actions</Typography><Box display="grid" gridTemplateColumns={{ xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }}>{standardActions.map((action) => <FormControlLabel key={action} control={<Checkbox checked={selected.includes(action)} onChange={(_event, checked) => setSelected((current) => checked ? [...new Set([...current, action])] : current.filter((value) => value !== action))} />} label={action} />)}</Box></Box>
        <TextField label="Custom actions" value={custom} onChange={(event) => setCustom(event.target.value)} helperText="Comma-separated lowercase actions, for example: export, archive" />
      </Stack></DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save'}</Button></DialogActions>
    </Dialog>
  )
}
