import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import { Alert, Avatar, Box, Button, Card, Checkbox, Chip, CircularProgress, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Select, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { MediaPickerDialog } from '../components/MediaPickerDialog'
import { api, apiErrorMessage } from '../lib/api'
import { categorySlug } from '../lib/category'
import { mediaPublicUrl } from '../lib/media'
import { generateVariantCombinations, productSku } from '../lib/product'
import type { ApiResponse, MediaAsset, Product, ProductFormOptions, ProductMediaReference } from '../types/api'

interface AttachmentDraft {
  mediaId: string
  asset: ProductMediaReference
  isThumbnail: boolean
  isGallery: boolean
  sortOrder: number
}

interface VariantDraft {
  key: string
  label: string
  attributeValueIds: string[]
  sku: string
  price: number
  salePrice: number | null
  stock: number
  lowStockThreshold: number
  weight: number | null
  active: boolean
  purchasable: boolean
  media: AttachmentDraft[]
}

type PickerTarget = { kind: 'product' } | { kind: 'variant'; index: number } | { kind: 'value'; valueId: string }

export function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [tab, setTab] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [sku, setSku] = useState('')
  const [shortDescription, setShortDescription] = useState('')
  const [longDescription, setLongDescription] = useState('')
  const [hasVariants, setHasVariants] = useState(false)
  const [price, setPrice] = useState<number | null>(0)
  const [salePrice, setSalePrice] = useState<number | null>(null)
  const [stock, setStock] = useState<number | null>(0)
  const [weight, setWeight] = useState<number | null>(null)
  const [active, setActive] = useState(true)
  const [featured, setFeatured] = useState(false)
  const [sortOrder, setSortOrder] = useState(0)
  const [brandId, setBrandId] = useState('')
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [media, setMedia] = useState<AttachmentDraft[]>([])
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({})
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [valueMedia, setValueMedia] = useState<Record<string, AttachmentDraft[]>>({})
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null)
  const [error, setError] = useState('')

  const options = useQuery({
    queryKey: ['product-options'],
    queryFn: async () => (await api.get<ApiResponse<ProductFormOptions>>('/products/form-options')).data.data,
  })
  const product = useQuery({
    queryKey: ['product', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<ApiResponse<Product>>(`/products/${id}`)).data.data,
  })

  useEffect(() => {
    if (initialized || !options.data || (id && !product.data)) return
    if (product.data) {
      const current = product.data
      setName(current.name); setSlug(current.slug); setSlugEdited(true); setSku(current.sku ?? '')
      setShortDescription(current.shortDescription ?? ''); setLongDescription(current.longDescription ?? '')
      setHasVariants(current.hasVariants); setPrice(current.price); setSalePrice(current.salePrice); setStock(current.stock); setWeight(current.weight)
      setActive(current.active); setFeatured(current.featured); setSortOrder(current.sortOrder); setBrandId(current.brandId ?? '')
      setCategoryIds(current.categories.map((category) => category.id))
      setMedia(current.media.map((item) => ({ mediaId: item.mediaId, asset: item.asset, isThumbnail: item.isThumbnail, isGallery: item.isGallery, sortOrder: item.sortOrder })))
      const selections: Record<string, string[]> = {}
      const shared: Record<string, AttachmentDraft[]> = {}
      const drafts = current.variants.map((variant) => {
        for (const value of variant.values) {
          selections[value.attributeId] = [...new Set([...(selections[value.attributeId] ?? []), value.id])]
          if (!shared[value.id]) shared[value.id] = value.media.map((asset, index) => ({ mediaId: asset.id, asset, isThumbnail: false, isGallery: true, sortOrder: index }))
        }
        return {
          key: variant.values.map((value) => `${value.attributeId}:${value.id}`).sort().join('|'),
          label: variant.values.map((value) => `${value.attribute.name}: ${value.value}`).join(' · '),
          attributeValueIds: variant.values.map((value) => value.id),
          sku: variant.sku, price: variant.price, salePrice: variant.salePrice, stock: variant.stock,
          lowStockThreshold: variant.lowStockThreshold, weight: variant.weight, active: variant.active,
          purchasable: variant.purchasable, media: variant.media.map((item) => ({ mediaId: item.mediaId, asset: item.asset, isThumbnail: item.isThumbnail, isGallery: item.isGallery, sortOrder: item.sortOrder })),
        }
      })
      setSelectedValues(selections); setValueMedia(shared); setVariants(drafts)
    }
    setInitialized(true)
  }, [id, initialized, options.data, product.data])

  const selectedAttributeList = useMemo(() => (options.data?.attributes ?? []).filter((attribute) => (selectedValues[attribute.id]?.length ?? 0) > 0).map((attribute) => ({
    attributeId: attribute.id,
    attributeName: attribute.name,
    values: (attribute.values ?? []).filter((value) => selectedValues[attribute.id]?.includes(value.id)).map((value) => ({ id: value.id, value: value.value, slug: value.slug })),
  })), [options.data, selectedValues])
  const usedValueIds = useMemo(() => [...new Set(variants.flatMap((variant) => variant.attributeValueIds))], [variants])

  const save = useMutation({
    mutationFn: () => {
      if (media.filter((item) => item.isThumbnail).length !== 1) throw new Error('Choose exactly one product thumbnail in the Media section')
      if (!hasVariants && (price === null || stock === null || !sku.trim())) throw new Error('Simple products require SKU, price, and stock')
      if (hasVariants && variants.length === 0) throw new Error('Generate at least one variant')
      const payload = {
        name, slug, sku: hasVariants ? null : sku, shortDescription: shortDescription || null, longDescription: longDescription || null,
        hasVariants, price: hasVariants ? null : price, salePrice: hasVariants ? null : salePrice, stock: hasVariants ? null : stock,
        weight, active, featured, sortOrder, brandId: brandId || null, categoryIds,
        media: media.map((item) => ({ mediaId: item.mediaId, isThumbnail: item.isThumbnail, isGallery: item.isGallery, sortOrder: item.sortOrder })),
        variants: hasVariants ? variants.map(({ key: _key, label: _label, media: variantMedia, ...variant }) => ({ ...variant, media: variantMedia.map((item) => ({ mediaId: item.mediaId, isThumbnail: item.isThumbnail, isGallery: item.isGallery, sortOrder: item.sortOrder })) })) : [],
        attributeValueMedia: hasVariants ? usedValueIds.flatMap((valueId) => (valueMedia[valueId] ?? []).map((item, index) => ({ attributeValueId: valueId, mediaId: item.mediaId, sortOrder: index }))) : [],
      }
      return id ? api.patch(`/products/${id}`, payload) : api.post('/products', payload)
    },
    onSuccess: () => navigate('/products', { replace: true }),
    onError: (requestError) => setError(apiErrorMessage(requestError)),
  })

  function generate() {
    const combinations = generateVariantCombinations(selectedAttributeList)
    const existing = new Map(variants.map((variant) => [canonicalKey(variant.key), variant]))
    setVariants(combinations.map((combination) => existing.get(canonicalKey(combination.key)) ?? {
      key: combination.key,
      label: combination.label,
      attributeValueIds: combination.valueIds,
      sku: productSku(sku || slug || name, combination.valueSlugs),
      price: price ?? 0, salePrice: null, stock: 0, lowStockThreshold: 0, weight, active: true, purchasable: true, media: [],
    }))
  }

  function chooseMedia(asset: MediaAsset) {
    if (!pickerTarget) return
    const reference: ProductMediaReference = asset
    if (pickerTarget.kind === 'product') setMedia((items) => appendAttachment(items, reference, true))
    if (pickerTarget.kind === 'variant') setVariants((items) => items.map((variant, index) => index === pickerTarget.index ? { ...variant, media: appendAttachment(variant.media, reference, false) } : variant))
    if (pickerTarget.kind === 'value') setValueMedia((items) => ({ ...items, [pickerTarget.valueId]: appendAttachment(items[pickerTarget.valueId] ?? [], reference, false) }))
    setPickerTarget(null)
  }

  if (options.isLoading || (id && product.isLoading) || !initialized) return <Box p={10} textAlign="center"><CircularProgress /></Box>
  if (options.isError || product.isError) return <Alert severity="error">{apiErrorMessage(options.error ?? product.error)}</Alert>

  return <Stack gap={2.5}>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap"><Box><Button startIcon={<ArrowBackOutlined />} onClick={() => navigate('/products')}>Products</Button><Typography variant="h4" fontWeight={800}>{id ? `Edit ${name}` : 'Create product'}</Typography><Typography color="text.secondary">All product, media, category, and variant changes save as one transaction.</Typography></Box><Button variant="contained" size="large" disabled={save.isPending || (Boolean(id) && !hasPermission('product:update'))} onClick={() => { setError(''); save.mutate() }}>{save.isPending ? 'Saving atomically…' : 'Save product'}</Button></Box>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    <Card><Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable"><Tab label="1. Details" /><Tab label="2. Catalog" /><Tab label="3. Media" /><Tab label={`4. Variants (${variants.length})`} disabled={!hasVariants} /></Tabs></Card>
    {tab === 0 && <Card><Stack p={3} gap={2.25}><Section title="Identity" description="The slug is unique. Simple SKUs and every variant SKU share the catalog namespace." /><Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '2fr 2fr 1.5fr' }} gap={2}><TextField label="Product name" required value={name} onChange={(event) => { const value = event.target.value; setName(value); if (!slugEdited) setSlug(categorySlug(value)) }} /><TextField label="Slug" required value={slug} onChange={(event) => { setSlugEdited(true); setSlug(categorySlug(event.target.value)) }} /><TextField label="Sort order" type="number" value={sortOrder} onChange={(event) => setSortOrder(nonnegative(event.target.value))} /></Box><TextField label="Short description" multiline minRows={2} value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} /><TextField label="Long description (plain text)" multiline minRows={6} value={longDescription} onChange={(event) => setLongDescription(event.target.value)} /><Stack direction={{ xs: 'column', sm: 'row' }} gap={2}><FormControlLabel control={<Switch checked={hasVariants} onChange={(event) => setHasVariants(event.target.checked)} />} label="Variable product" /><FormControlLabel control={<Switch checked={active} onChange={(event) => setActive(event.target.checked)} />} label="Active" /><FormControlLabel control={<Switch checked={featured} onChange={(event) => setFeatured(event.target.checked)} />} label="Featured" /></Stack>{hasVariants ? <Alert severity="info">Price, stock, and SKU are set on each generated variant.</Alert> : <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(5, 1fr)' }} gap={2}><TextField label="SKU" required value={sku} onChange={(event) => setSku(event.target.value.toUpperCase())} /><NumberField label="Price" value={price} onChange={setPrice} required /><NumberField label="Sale price" value={salePrice} onChange={setSalePrice} /><NumberField label="Stock" value={stock} onChange={setStock} integer required /><NumberField label="Weight" value={weight} onChange={setWeight} /></Box>}</Stack></Card>}
    {tab === 1 && <Card><Stack p={3} gap={2.5}><Section title="Classification" description="A product may belong to one brand and many categories." /><FormControl><InputLabel>Brand</InputLabel><Select label="Brand" value={brandId} onChange={(event) => setBrandId(event.target.value)}><MenuItem value="">No brand</MenuItem>{options.data?.brands.map((brand) => <MenuItem key={brand.id} value={brand.id}>{brand.name}</MenuItem>)}</Select></FormControl><FormControl><InputLabel>Categories</InputLabel><Select multiple label="Categories" value={categoryIds} onChange={(event) => setCategoryIds(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)} renderValue={(selected) => options.data?.categories.filter((category) => selected.includes(category.id)).map((category) => category.name).join(', ')}>{options.data?.categories.map((category) => <MenuItem key={category.id} value={category.id}><Checkbox checked={categoryIds.includes(category.id)} />{category.name}</MenuItem>)}</Select></FormControl></Stack></Card>}
    {tab === 2 && <Card><Stack p={3} gap={2}><Box display="flex" justifyContent="space-between" alignItems="center"><Section title="Product media" description="Exactly one image must be the thumbnail. Reorder gallery assets with the arrows." /><Button variant="outlined" startIcon={<ImageOutlined />} disabled={!hasPermission('media:read')} onClick={() => setPickerTarget({ kind: 'product' })}>Add image</Button></Box>{media.length === 0 ? <Alert severity="warning">Add at least one image and choose its thumbnail.</Alert> : <AttachmentList items={media} requireThumbnail onChange={setMedia} />}</Stack></Card>}
    {tab === 3 && hasVariants && <Stack gap={2}>
      <Card><Stack p={3} gap={2}><Section title="Combination builder" description="Select participating values, then generate the complete Cartesian set of variants." />{options.data?.attributes.map((attribute) => <FormControl key={attribute.id}><InputLabel>{attribute.name}</InputLabel><Select multiple label={attribute.name} value={selectedValues[attribute.id] ?? []} onChange={(event) => setSelectedValues((current) => ({ ...current, [attribute.id]: typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value }))} renderValue={(selected) => attribute.values?.filter((value) => selected.includes(value.id)).map((value) => value.value).join(', ')}>{attribute.values?.map((value) => <MenuItem key={value.id} value={value.id}><Checkbox checked={selectedValues[attribute.id]?.includes(value.id) ?? false} />{value.value}</MenuItem>)}</Select></FormControl>)}<Button variant="contained" onClick={generate} disabled={selectedAttributeList.length === 0}>Generate all combinations</Button><Alert severity="info">Generation preserves rows with matching combinations and removes combinations no longer selected.</Alert></Stack></Card>
      {variants.map((variant, index) => <Card key={variant.key}><Stack p={2.5} gap={2}><Box display="flex" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={800}>{variant.label}</Typography><Typography variant="caption" color="text.secondary">Derived stock status: {variant.stock === 0 ? 'out of stock' : variant.lowStockThreshold > 0 && variant.stock <= variant.lowStockThreshold ? 'low stock' : 'in stock'}</Typography></Box><IconButton color="error" onClick={() => setVariants((items) => items.filter((_item, itemIndex) => itemIndex !== index))}><DeleteOutline /></IconButton></Box><Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '2fr repeat(5, 1fr)' }} gap={1.5}><TextField label="Variant SKU" required value={variant.sku} onChange={(event) => updateVariant(setVariants, index, { sku: event.target.value.toUpperCase() })} /><NumberField label="Price" value={variant.price} onChange={(value) => updateVariant(setVariants, index, { price: value ?? 0 })} required /><NumberField label="Sale" value={variant.salePrice} onChange={(value) => updateVariant(setVariants, index, { salePrice: value })} /><NumberField label="Stock" value={variant.stock} onChange={(value) => updateVariant(setVariants, index, { stock: value ?? 0 })} integer required /><NumberField label="Low at" value={variant.lowStockThreshold} onChange={(value) => updateVariant(setVariants, index, { lowStockThreshold: value ?? 0 })} integer /><NumberField label="Weight" value={variant.weight} onChange={(value) => updateVariant(setVariants, index, { weight: value })} /></Box><Stack direction="row" gap={2}><FormControlLabel control={<Switch checked={variant.active} onChange={(event) => updateVariant(setVariants, index, { active: event.target.checked })} />} label="Active" /><FormControlLabel control={<Switch checked={variant.purchasable} onChange={(event) => updateVariant(setVariants, index, { purchasable: event.target.checked })} />} label="Purchasable" /><Button startIcon={<ImageOutlined />} onClick={() => setPickerTarget({ kind: 'variant', index })}>Add variant image</Button></Stack>{variant.media.length > 0 && <AttachmentList items={variant.media} onChange={(items) => updateVariant(setVariants, index, { media: items })} />}</Stack></Card>)}
      {usedValueIds.length > 0 && <Card><Stack p={3} gap={2}><Section title="Shared attribute-value media" description="Attach reusable imagery to a value such as Red, so every Red variant can show it without duplicate records." />{usedValueIds.map((valueId) => { const value = options.data?.attributes.flatMap((attribute) => attribute.values ?? []).find((item) => item.id === valueId); return <Box key={valueId} border={1} borderColor="divider" borderRadius={2} p={2}><Box display="flex" justifyContent="space-between" alignItems="center"><Typography fontWeight={750}>{value?.value}</Typography><Button size="small" onClick={() => setPickerTarget({ kind: 'value', valueId })}>Add shared image</Button></Box>{(valueMedia[valueId]?.length ?? 0) > 0 && <AttachmentList items={valueMedia[valueId]} onChange={(items) => setValueMedia((current) => ({ ...current, [valueId]: items }))} />}</Box> })}</Stack></Card>}
    </Stack>}
    <MediaPickerDialog open={Boolean(pickerTarget)} selectedId={null} onClose={() => setPickerTarget(null)} onSelect={chooseMedia} />
  </Stack>
}

function Section({ title, description }: { title: string; description: string }) { return <Box><Typography variant="h6" fontWeight={800}>{title}</Typography><Typography variant="body2" color="text.secondary">{description}</Typography></Box> }

function NumberField({ label, value, onChange, integer = false, required = false }: { label: string; value: number | null; onChange: (value: number | null) => void; integer?: boolean; required?: boolean }) {
  return <TextField label={label} type="number" required={required} value={value ?? ''} inputProps={{ min: 0, step: integer ? 1 : .01 }} onChange={(event) => onChange(event.target.value === '' ? null : Math.max(0, integer ? Math.floor(Number(event.target.value)) : Number(event.target.value)))} />
}

function AttachmentList({ items, onChange, requireThumbnail = false }: { items: AttachmentDraft[]; onChange: (items: AttachmentDraft[]) => void; requireThumbnail?: boolean }) {
  function move(index: number, direction: -1 | 1) { const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onChange(next.map((item, sortOrder) => ({ ...item, sortOrder }))) }
  return <Stack gap={1} mt={1}>{items.map((item, index) => <Box key={item.mediaId} display="flex" alignItems="center" gap={1.5} border={1} borderColor="divider" borderRadius={2} p={1}><Avatar variant="rounded" src={mediaPublicUrl(item.asset.thumbnailUrl ?? item.asset.publicUrl)} /><Box flex={1} minWidth={0}><Typography noWrap fontWeight={700}>{item.asset.title || item.asset.fileName}</Typography><Stack direction="row" gap={1}><Chip size="small" color={item.isThumbnail ? 'primary' : 'default'} label={item.isThumbnail ? 'Thumbnail' : 'Set thumbnail'} onClick={() => onChange(items.map((candidate) => ({ ...candidate, isThumbnail: candidate.mediaId === item.mediaId })))} /><FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" checked={item.isGallery} onChange={(event) => onChange(items.map((candidate) => candidate.mediaId === item.mediaId ? { ...candidate, isGallery: event.target.checked } : candidate))} />} label={<Typography variant="caption">Gallery</Typography>} /></Stack></Box><IconButton size="small" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUpwardOutlined /></IconButton><IconButton size="small" disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDownwardOutlined /></IconButton><IconButton size="small" color="error" onClick={() => { const next = items.filter((candidate) => candidate.mediaId !== item.mediaId); if (requireThumbnail && item.isThumbnail && next[0]) next[0] = { ...next[0], isThumbnail: true }; onChange(next.map((candidate, sortOrder) => ({ ...candidate, sortOrder }))) }}><DeleteOutline /></IconButton></Box>)}</Stack>
}

function appendAttachment(items: AttachmentDraft[], asset: ProductMediaReference, makeFirstThumbnail: boolean): AttachmentDraft[] {
  if (items.some((item) => item.mediaId === asset.id)) return items
  return [...items, { mediaId: asset.id, asset, isThumbnail: makeFirstThumbnail && items.length === 0, isGallery: true, sortOrder: items.length }]
}

function updateVariant(setter: React.Dispatch<React.SetStateAction<VariantDraft[]>>, index: number, update: Partial<VariantDraft>) { setter((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item)) }
function nonnegative(value: string): number { return Math.max(0, Math.floor(Number(value) || 0)) }
function canonicalKey(value: string): string { return value.split('|').sort().join('|') }
