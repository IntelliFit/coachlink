interface SearchableAction {
  id: string
  name?: string | null
  type?: string | null
  canonical_action_id?: string | null
}

export type PickerSearchResult<O, P> =
  | { kind: 'owned'; action: O }
  | { kind: 'public'; action: P }

const TRAINABLE_TYPES = new Set(['STRENGTH', 'CARDIO'])

function isTrainable(action: SearchableAction): boolean {
  return TRAINABLE_TYPES.has(String(action.type || 'STRENGTH').toUpperCase())
}

function nameRank(action: SearchableAction, term: string): number {
  const name = String(action.name || '').trim().toLowerCase()
  if (name === term) return 0
  if (name.startsWith(term)) return 1
  return name.includes(term) ? 2 : 3
}

/**
 * 选动作页的搜索结果：不分常用/我的/公共，也不受力量/街健/有氧和部位筛选影响。
 * 同一个动作只留一条，自己动作库里的优先（不会再往动作库重复加），名字越接近越靠前。
 */
export function mergePickerSearchResults<O extends SearchableAction, P extends SearchableAction>(
  rawTerm: string,
  owned: O[],
  publicActions: P[],
): Array<PickerSearchResult<O, P>> {
  const term = rawTerm.trim().toLowerCase()
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const seenCanonical = new Set<string>()

  const isNew = (action: SearchableAction) => {
    const name = String(action.name || '').trim()
    const canonical = action.canonical_action_id || ''
    if (seenIds.has(action.id) || (name && seenNames.has(name)) || (canonical && seenCanonical.has(canonical))) return false
    seenIds.add(action.id)
    if (name) seenNames.add(name)
    if (canonical) seenCanonical.add(canonical)
    return true
  }

  const ownedItems = owned.filter(isTrainable).filter(isNew)
    .map((action) => ({ kind: 'owned' as const, action }))
  const publicItems = publicActions.filter(isTrainable).filter(isNew)
    .map((action) => ({ kind: 'public' as const, action }))

  return [...ownedItems, ...publicItems]
    .map((item, index) => ({ item, index, rank: nameRank(item.action, term) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item)
}
