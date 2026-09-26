interface CategoryLike {
  id: string;
  parentId: string | null;
  order: number;
  name: string;
}

/** Categoria pai logo seguida das próprias subcategorias, não a ordem crua do banco. */
export function sortCategoriesTree<T extends CategoryLike>(categories: T[]): T[] {
  const byParent = new Map<string | null, T[]>();
  for (const category of categories) {
    const key = category.parentId;
    const bucket = byParent.get(key) ?? [];
    bucket.push(category);
    byParent.set(key, bucket);
  }
  for (const bucket of byParent.values()) {
    bucket.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
  }

  const result: T[] = [];
  const walk = (parentId: string | null) => {
    for (const category of byParent.get(parentId) ?? []) {
      result.push(category);
      walk(category.id);
    }
  };
  walk(null);
  return result;
}
