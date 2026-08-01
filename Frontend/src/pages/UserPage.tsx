import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import {
  Alert, Avatar, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, FormControlLabel, IconButton,
  InputAdornment, InputLabel, MenuItem, Pagination, Select, Snackbar, Stack,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { api, apiErrorMessage } from '../lib/api'
import type { ApiResponse, Pagination as PaginationType, Role, User } from '../types/api'

export function UserPage() {
  const { hasPermission, user: sessionUser } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<User | null | undefined>()
  const [message, setMessage] = useState('')
  const roles = useQuery({ queryKey: ['role-options'], queryFn: async () => (await api.get<ApiResponse<Array<Pick<Role, 'id' | 'name'>>>>('/users/role-options')).data.data })
  const users = useQuery({ queryKey: ['users', page, search, roleId, status], queryFn: async () => (await api.get<ApiResponse<{ items: User[]; pagination: PaginationType }>>('/users', { params: { page, limit: 10, search, roleId: roleId || undefined, active: status || undefined } })).data.data })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/users/${id}`), onSuccess: () => { setMessage('User deleted'); void queryClient.invalidateQueries({ queryKey: ['users'] }) }, onError: (error) => setMessage(apiErrorMessage(error)) })

  return <Stack gap={2.5}>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap"><Box><Typography variant="h4" fontWeight={800}>Users</Typography><Typography color="text.secondary">Dashboard accounts, roles, and active status.</Typography></Box>{hasPermission('user:create') && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEditing(null)}>New user</Button>}</Box>
    <Card>
      <Box p={2} display="flex" gap={2} flexWrap="wrap"><TextField size="small" placeholder="Search name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} /><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Role</InputLabel><Select label="Role" value={roleId} onChange={(event) => { setRoleId(event.target.value); setPage(1) }}><MenuItem value="">All roles</MenuItem>{roles.data?.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}</Select></FormControl><FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><MenuItem value="">All</MenuItem><MenuItem value="true">Active</MenuItem><MenuItem value="false">Inactive</MenuItem></Select></FormControl></Box>
      {users.isLoading ? <Box p={6} textAlign="center"><CircularProgress /></Box> : users.isError ? <Alert severity="error">{apiErrorMessage(users.error)}</Alert> : users.data?.items.length === 0 ? <Alert severity="info">No users found.</Alert> : <TableContainer><Table><TableHead><TableRow><TableCell>User</TableCell><TableCell>Phone</TableCell><TableCell>Role</TableCell><TableCell>Status</TableCell><TableCell align="right">Manage</TableCell></TableRow></TableHead><TableBody>{users.data?.items.map((user) => <TableRow key={user.id} hover><TableCell><Stack direction="row" alignItems="center" gap={1.5}><Avatar src={user.avatarUrl ?? undefined}>{user.name.charAt(0)}</Avatar><Box><Typography fontWeight={700}>{user.name}</Typography><Typography variant="body2" color="text.secondary">{user.email}</Typography></Box></Stack></TableCell><TableCell>{user.phone || '—'}</TableCell><TableCell>{user.role.name}</TableCell><TableCell><Chip size="small" color={user.active ? 'success' : 'default'} label={user.active ? 'Active' : 'Inactive'} /></TableCell><TableCell align="right">{hasPermission('user:update') && <Tooltip title="Edit"><IconButton onClick={() => setEditing(user)}><EditOutlined /></IconButton></Tooltip>}{hasPermission('user:delete') && user.id !== sessionUser?.id && <Tooltip title="Delete"><IconButton color="error" onClick={() => { if (window.confirm(`Delete ${user.name}? This is a soft delete.`)) remove.mutate(user.id) }}><DeleteOutline /></IconButton></Tooltip>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
      {users.data && <Box p={2} display="flex" justifyContent="center"><Pagination page={users.data.pagination.page} count={users.data.pagination.totalPages} onChange={(_event, value) => setPage(value)} /></Box>}
    </Card>
    {editing !== undefined && <UserDialog user={editing} roles={roles.data ?? []} lockRole={editing?.id === sessionUser?.id} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setMessage('User saved'); void queryClient.invalidateQueries({ queryKey: ['users'] }) }} />}
    <Snackbar open={Boolean(message)} autoHideDuration={4500} onClose={() => setMessage('')} message={message} />
  </Stack>
}

function UserDialog({ user, roles, lockRole, onClose, onSaved }: { user: User | null; roles: Array<Pick<Role, 'id' | 'name'>>; lockRole: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', password: '', phone: user?.phone ?? '', gender: user?.gender ?? '', avatarUrl: user?.avatarUrl ?? '', roleId: user?.role.id ?? '', active: user?.active ?? true })
  const [error, setError] = useState('')
  const mutation = useMutation({ mutationFn: () => { const payload = { ...form, gender: form.gender || null, avatarUrl: form.avatarUrl || null, phone: form.phone || null }; return user ? api.patch(`/users/${user.id}`, payload) : api.post('/users', payload) }, onSuccess: onSaved, onError: (requestError) => setError(apiErrorMessage(requestError)) })
  const change = (field: string, value: unknown) => setForm((current) => ({ ...current, [field]: value }))

  return <Dialog open fullWidth maxWidth="md" onClose={onClose}><DialogTitle>{user ? 'Edit user' : 'Create user'}</DialogTitle><DialogContent><Stack gap={2} pt={1}>
    {error && <Alert severity="error">{error}</Alert>}
    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
      <TextField label="Name" required value={form.name} onChange={(event) => change('name', event.target.value)} />
      <TextField label="Email" type="email" required value={form.email} onChange={(event) => change('email', event.target.value)} />
      <TextField label={user ? 'New password (optional)' : 'Password'} type="password" required={!user} value={form.password} onChange={(event) => change('password', event.target.value)} helperText="Minimum 8 characters" />
      <TextField label="Phone" value={form.phone} onChange={(event) => change('phone', event.target.value)} />
      <FormControl required disabled={lockRole}><InputLabel>Role</InputLabel><Select label="Role" value={form.roleId} onChange={(event) => change('roleId', event.target.value)}>{roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}</Select>{lockRole && <Typography variant="caption" color="text.secondary">You cannot change your own role.</Typography>}</FormControl>
      <FormControl><InputLabel>Gender</InputLabel><Select label="Gender" value={form.gender} onChange={(event) => change('gender', event.target.value)}><MenuItem value="">Not specified</MenuItem><MenuItem value="MALE">Male</MenuItem><MenuItem value="FEMALE">Female</MenuItem><MenuItem value="OTHER">Other</MenuItem><MenuItem value="PREFER_NOT_TO_SAY">Prefer not to say</MenuItem></Select></FormControl>
    </Box>
    <TextField label="Avatar URL" type="url" value={form.avatarUrl} onChange={(event) => change('avatarUrl', event.target.value)} helperText="This will be replaced by the shared media picker when the Media module is built." />
    <FormControlLabel control={<Switch checked={form.active} onChange={(_event, checked) => change('active', checked)} />} label={form.active ? 'Active account' : 'Inactive account'} />
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={!form.name.trim() || !form.email.trim() || !form.roleId || (!user && form.password.length < 8) || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Saving…' : 'Save user'}</Button></DialogActions></Dialog>
}
