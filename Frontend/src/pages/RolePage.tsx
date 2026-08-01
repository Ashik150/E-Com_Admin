import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, IconButton, InputAdornment, InputLabel,
  MenuItem, Pagination, Select, Snackbar, Stack, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { api, apiErrorMessage } from '../lib/api'
import type { ApiResponse, Pagination as PaginationType, PermissionGroup, Role } from '../types/api'

export function RolePage() {
  const { hasPermission, user } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Role | null | undefined>()
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['roles', page, search, status],
    queryFn: async () => (await api.get<ApiResponse<{ items: Role[]; pagination: PaginationType }>>('/roles', { params: { page, limit: 10, search, status: status || undefined } })).data.data,
  })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/roles/${id}`), onSuccess: () => { setMessage('Role deleted'); void queryClient.invalidateQueries({ queryKey: ['roles'] }) }, onError: (error) => setMessage(apiErrorMessage(error)) })

  async function edit(role: Role) {
    try {
      const response = await api.get<ApiResponse<Role>>(`/roles/${role.id}`)
      setEditing(response.data.data)
    } catch (error) { setMessage(apiErrorMessage(error)) }
  }

  return <Stack gap={2.5}>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap"><Box><Typography variant="h4" fontWeight={800}>Roles</Typography><Typography color="text.secondary">Bundle permissions into dashboard job functions.</Typography></Box>{hasPermission('role:create') && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEditing(null)}>New role</Button>}</Box>
    <Card>
      <Box p={2} display="flex" gap={2} flexWrap="wrap"><TextField size="small" placeholder="Search roles" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} /><FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><MenuItem value="">All</MenuItem><MenuItem value="ACTIVE">Active</MenuItem><MenuItem value="INACTIVE">Inactive</MenuItem></Select></FormControl></Box>
      {query.isLoading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : query.isError ? <Alert severity="error">{apiErrorMessage(query.error)}</Alert> : query.data?.items.length === 0 ? <Alert severity="info">No roles found.</Alert> : <TableContainer><Table><TableHead><TableRow><TableCell>Role</TableCell><TableCell>Status</TableCell><TableCell>Permissions</TableCell><TableCell>Users</TableCell><TableCell align="right">Manage</TableCell></TableRow></TableHead><TableBody>{query.data?.items.map((role) => { const ownRole = role.id === user?.role.id; return <TableRow key={role.id} hover><TableCell><Typography fontWeight={700}>{role.name}</Typography><Typography variant="body2" color="text.secondary">{role.description || '—'}</Typography></TableCell><TableCell><Chip size="small" color={role.status === 'ACTIVE' ? 'success' : 'default'} label={role.status === 'ACTIVE' ? 'Active' : 'Inactive'} /></TableCell><TableCell>{role.permissionCount}</TableCell><TableCell>{role.userCount}</TableCell><TableCell align="right">{ownRole ? <Typography variant="caption" color="text.secondary">Current role</Typography> : <>{hasPermission('role:update') && <Tooltip title="Edit"><IconButton onClick={() => void edit(role)}><EditOutlined /></IconButton></Tooltip>}{hasPermission('role:delete') && <Tooltip title="Delete"><IconButton color="error" onClick={() => { if (window.confirm(`Delete ${role.name}?`)) remove.mutate(role.id) }}><DeleteOutline /></IconButton></Tooltip>}</>}</TableCell></TableRow> })}</TableBody></Table></TableContainer>}
      {query.data && <Box p={2} display="flex" justifyContent="center"><Pagination page={query.data.pagination.page} count={query.data.pagination.totalPages} onChange={(_event, value) => setPage(value)} /></Box>}
    </Card>
    {editing !== undefined && <RoleDialog role={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setMessage('Role saved'); void queryClient.invalidateQueries({ queryKey: ['roles'] }) }} />}
    <Snackbar open={Boolean(message)} message={message} autoHideDuration={4500} onClose={() => setMessage('')} />
  </Stack>
}

function RoleDialog({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [active, setActive] = useState(role?.status !== 'INACTIVE')
  const [selected, setSelected] = useState<string[]>(role?.permissionIds ?? [])
  const [error, setError] = useState('')
  const groups = useQuery({ queryKey: ['permission-grid'], queryFn: async () => (await api.get<ApiResponse<{ items: PermissionGroup[] }>>('/permissions', { params: { page: 1, limit: 100 } })).data.data.items })
  const mutation = useMutation({ mutationFn: () => role ? api.patch(`/roles/${role.id}`, { name, description, status: active ? 'ACTIVE' : 'INACTIVE', permissionIds: selected }) : api.post('/roles', { name, description, status: active ? 'ACTIVE' : 'INACTIVE', permissionIds: selected }), onSuccess: onSaved, onError: (requestError) => setError(apiErrorMessage(requestError)) })
  const allIds = groups.data?.flatMap((group) => group.actions.map((action) => action.id)) ?? []

  function toggleGroup(group: PermissionGroup, checked: boolean) {
    const ids = group.actions.map((action) => action.id)
    setSelected((current) => checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)))
  }

  return <Dialog open fullWidth maxWidth="lg" onClose={onClose}><DialogTitle>{role ? 'Edit role' : 'Create role'}</DialogTitle><DialogContent><Stack gap={2.5} pt={1}>
    {error && <Alert severity="error">{error}</Alert>}
    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}><TextField label="Role name" required value={name} onChange={(event) => setName(event.target.value)} /><TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} /></Box>
    <Stack direction="row" alignItems="center"><Switch checked={active} onChange={(_event, checked) => setActive(checked)} /><Typography>{active ? 'Active' : 'Inactive'}</Typography></Stack>
    <Box display="flex" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={700}>Permission grid</Typography><Button size="small" onClick={() => setSelected(selected.length === allIds.length ? [] : allIds)}>{selected.length === allIds.length ? 'Clear all' : 'Grant all'}</Button></Box>
    {groups.isLoading ? <CircularProgress /> : groups.isError ? <Alert severity="error">{apiErrorMessage(groups.error)}</Alert> : <TableContainer sx={{ maxHeight: 440, border: 1, borderColor: 'divider', borderRadius: 2 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Module</TableCell><TableCell>Select all</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>{groups.data?.map((group) => { const ids = group.actions.map((action) => action.id); const checked = ids.every((id) => selected.includes(id)); const indeterminate = !checked && ids.some((id) => selected.includes(id)); return <TableRow key={group.id}><TableCell><Typography fontWeight={700}>{group.name}</Typography></TableCell><TableCell><Checkbox checked={checked} indeterminate={indeterminate} onChange={(_event, value) => toggleGroup(group, value)} /></TableCell><TableCell><Stack direction="row" flexWrap="wrap" gap={1}>{group.actions.map((action) => <Chip key={action.id} clickable color={selected.includes(action.id) ? 'primary' : 'default'} variant={selected.includes(action.id) ? 'filled' : 'outlined'} label={action.action} onClick={() => setSelected((current) => current.includes(action.id) ? current.filter((id) => id !== action.id) : [...current, action.id])} />)}</Stack></TableCell></TableRow> })}</TableBody></Table></TableContainer>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save role'}</Button></DialogActions></Dialog>
}
