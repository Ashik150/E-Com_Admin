export interface VariantCombination {
  key: string
  valueIds: string[]
  valueSlugs: string[]
  label: string
}

export interface SelectedVariantAttribute {
  attributeId: string
  attributeName: string
  values: Array<{ id: string; value: string; slug: string }>
}

export function generateVariantCombinations(attributes: SelectedVariantAttribute[]): VariantCombination[] {
  if (attributes.length === 0 || attributes.some((attribute) => attribute.values.length === 0)) return []
  return attributes.reduce<VariantCombination[]>((combinations, attribute) => {
    if (combinations.length === 0) {
      return attribute.values.map((value) => ({
        key: `${attribute.attributeId}:${value.id}`,
        valueIds: [value.id],
        valueSlugs: [value.slug],
        label: `${attribute.attributeName}: ${value.value}`,
      }))
    }
    return combinations.flatMap((combination) => attribute.values.map((value) => ({
      key: `${combination.key}|${attribute.attributeId}:${value.id}`,
      valueIds: [...combination.valueIds, value.id],
      valueSlugs: [...combination.valueSlugs, value.slug],
      label: `${combination.label} · ${attribute.attributeName}: ${value.value}`,
    })))
  }, [])
}

export function productSku(base: string, valueSlugs: string[]): string {
  const normalized = [base, ...valueSlugs]
    .join('-')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
  return normalized.slice(0, 100)
}

export function productPriceLabel(min: number, max: number): string {
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  return min === max ? currency.format(min) : `${currency.format(min)} – ${currency.format(max)}`
}
