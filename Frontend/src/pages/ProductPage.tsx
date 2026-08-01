import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import SearchOutlined from '@mui/icons-material/SearchOutlined'
import {
  Alert, Avatar, Box, Button, Card, Chip, CircularProgress, FormControl,
  IconButton, InputAdornment, InputLabel, MenuItem, Pagination, Select,
  Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { api, apiErrorMessage } from '../lib/api'
import { mediaPublicUrl } from '../lib/media'
import { productPriceLabel } from '../lib/product'
import type { ApiResponse, Pagination as PaginationType, ProductFormOptions, ProductListItem } from '../types/api'

export function ProductPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [active, setActive] = useState('')
  const [sort, setSort] = useState('createdAt:desc')
  const [message, setMessage] = useState('')
  const options = useQuery({
    queryKey: ['product-options'],
    queryFn: async () => (await api.get<ApiResponse<ProductFormOptions>>('/products/form-options')).data.data,
  })
  const query = useQuery({
    queryKey: ['products', page, search, brandId, categoryId, active, sort],
    queryFn: async () => {
      const [sortBy, sortOrder] = sort.split(':')
      return (await api.get<ApiResponse<{ items: ProductListItem[]; pagination: PaginationType }>>('/products', {
        params: { page, limit: 10, search, brandId: brandId || undefined, categoryId: categoryId || undefined, active: active || undefined, sortBy, sortOrder },
      })).data.data
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { setMessage('Product deleted; shared media assets were preserved'); void queryClient.invalidateQueries({ queryKey: ['products'] }) },
    onError: (error) => setMessage(apiErrorMessage(error)),
  })

  return <Stack gap={2.5}>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
      <Box><Typography variant="h4" fontWeight={800}>Products</Typography><Typography color="text.secondary">Simple and variable inventory with atomic catalog updates.</Typography></Box>
      {hasPermission('product:create') && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => navigate('/products/new')}>New product</Button>}
    </Box>
    <Card>
      <Box p={2} display="grid" gridTemplateColumns={{ xs: '1fr', md: 'minmax(260px, 2fr) repeat(4, minmax(145px, 1fr))' }} gap={1.5}>
        <TextField size="small" placeholder="Search name or any SKU" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} />
        <FilterSelect label="Brand" value={brandId} onChange={setBrandId} items={options.data?.brands ?? []} all="All brands" />
        <FilterSelect label="Category" value={categoryId} onChange={setCategoryId} items={options.data?.categories ?? []} all="All categories" />
        <FormControl size="small"><InputLabel>Status</InputLabel><Select label="Status" value={active} onChange={(event) => { setActive(event.target.value); setPage(1) }}><MenuItem value="">All statuses</MenuItem><MenuItem value="true">Active</MenuItem><MenuItem value="false">Inactive</MenuItem></Select></FormControl>
        <FormControl size="small"><InputLabel>Sort</InputLabel><Select label="Sort" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><MenuItem value="createdAt:desc">Newest</MenuItem><MenuItem value="name:asc">Name A–Z</MenuItem><MenuItem value="sortOrder:asc">Manual order</MenuItem><MenuItem value="price:asc">Price low–high</MenuItem></Select></FormControl>
      </Box>
      {query.isLoading ? <Box p={8} textAlign="center"><CircularProgress /></Box> : query.isError ? <Alert severity="error">{apiErrorMessage(query.error)}</Alert> : query.data?.items.length === 0 ? <Alert severity="info">No products match these filters.</Alert> : <TableContainer><Table><TableHead><TableRow><TableCell>Product</TableCell><TableCell>Brand / categories</TableCell><TableCell>Price</TableCell><TableCell>Stock</TableCell><TableCell>Status</TableCell><TableCell align="right">Manage</TableCell></TableRow></TableHead><TableBody>{query.data?.items.map((product) => <TableRow key={product.id} hover>
        <TableCell><Stack direction="row" alignItems="center" gap={1.5}><Avatar variant="rounded" src={mediaPublicUrl(product.thumbnail?.thumbnailUrl ?? product.thumbnail?.publicUrl ?? null)} sx={{ width: 52, height: 52 }}><Inventory2Outlined /></Avatar><Box><Typography fontWeight={750}>{product.name}</Typography><Typography variant="caption" color="text.secondary">{product.hasVariants ? 'Variable product' : product.sku}</Typography></Box></Stack></TableCell>
        <TableCell><Typography variant="body2">{product.brand?.name ?? 'No brand'}</Typography><Typography variant="caption" color="text.secondary">{product.categories.map((category) => category.name).join(', ') || 'Uncategorised'}</Typography></TableCell>
        <TableCell>{productPriceLabel(product.priceMin, product.priceMax)}</TableCell>
        <TableCell><Typography fontWeight={700}>{product.stock}</Typography><Typography variant="caption" color="text.secondary">{product.stockStatus.replaceAll('_', ' ').toLowerCase()}</Typography></TableCell>
        <TableCell><Stack direction="row" gap={.75}><Chip size="small" color={product.active ? 'success' : 'default'} label={product.active ? 'Active' : 'Inactive'} />{product.featured && <Chip size="small" color="primary" label="Featured" />}</Stack></TableCell>
        <TableCell align="right">{hasPermission('product:update') && <Tooltip title="Edit"><IconButton onClick={() => navigate(`/products/${product.id}/edit`)}><EditOutlined /></IconButton></Tooltip>}{hasPermission('product:delete') && <Tooltip title="Delete"><IconButton color="error" onClick={() => { if (window.confirm(`Delete ${product.name} and all of its variants? Shared media files will remain.`)) remove.mutate(product.id) }}><DeleteOutline /></IconButton></Tooltip>}</TableCell>
      </TableRow>)}</TableBody></Table></TableContainer>}
      {query.data && query.data.pagination.totalPages > 1 && <Box p={2} display="flex" justifyContent="center"><Pagination page={query.data.pagination.page} count={query.data.pagination.totalPages} onChange={(_event, value) => setPage(value)} /></Box>}
    </Card>
    <Snackbar open={Boolean(message)} message={message} autoHideDuration={5000} onClose={() => setMessage('')} />
  </Stack>
}

function FilterSelect({ label, value, onChange, items, all }: { label: string; value: string; onChange: (value: string) => void; items: Array<{ id: string; name: string }>; all: string }) {
  return <FormControl size="small"><InputLabel>{label}</InputLabel><Select label={label} value={value} onChange={(event) => onChange(event.target.value)}><MenuItem value="">{all}</MenuItem>{items.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</Select></FormControl>
}
