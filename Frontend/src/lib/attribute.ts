import type { AttributeType } from '../types/api'

export const attributeTypeLabels: Record<AttributeType, string> = {
  DROPDOWN: 'Dropdown',
  RADIO: 'Radio',
  CHECKBOX: 'Checkbox',
  COLOR_SWATCH: 'Colour swatch',
  IMAGE_SWATCH: 'Image swatch',
}

export const attributeTypes = Object.keys(attributeTypeLabels) as AttributeType[]

export function attributeReferenceKind(
  type: AttributeType,
): 'none' | 'colour' | 'image' {
  if (type === 'COLOR_SWATCH') return 'colour'
  if (type === 'IMAGE_SWATCH') return 'image'
  return 'none'
}
