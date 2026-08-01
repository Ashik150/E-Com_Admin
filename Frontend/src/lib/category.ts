import type { CategoryNode } from '../types/api'

export interface CategoryOption {
  id: string
  label: string
  depth: number
}

export function categorySlug(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function flattenCategoryTree(
  tree: CategoryNode[],
  excludedIds: Set<string> = new Set(),
  depth = 0,
): CategoryOption[] {
  return tree.flatMap((category) => [
    ...(excludedIds.has(category.id)
      ? []
      : [{ id: category.id, label: category.name, depth }]),
    ...flattenCategoryTree(category.children, excludedIds, depth + 1),
  ])
}

export function categoryBranchIds(
  tree: CategoryNode[],
  categoryId: string,
): Set<string> {
  const excluded = new Set<string>()
  function visit(nodes: CategoryNode[], insideBranch: boolean) {
    for (const node of nodes) {
      const isInside = insideBranch || node.id === categoryId
      if (isInside) excluded.add(node.id)
      visit(node.children, isInside)
    }
  }
  visit(tree, false)
  return excluded
}
