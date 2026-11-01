/**
 * 训练中调整动作顺序的共享规则。
 * order[新位置] = 旧下标；服务端落库和小程序本地状态都按同一份 order 换算。
 */
export interface OrderableAction {
  action_id?: unknown
  source_action_id?: unknown
  action_name?: unknown
  source?: unknown
  source_action_index?: unknown
  completed_sets?: unknown
  total_sets?: unknown
}

export function isValidActionOrder(order: unknown, length: number): order is number[] {
  if (!Array.isArray(order) || order.length !== length) return false
  const seen = new Set<number>()
  for (const value of order) {
    if (!Number.isInteger(value) || value < 0 || value >= length || seen.has(value)) return false
    seen.add(value)
  }
  return true
}

export function isIdentityActionOrder(order: number[]): boolean {
  return order.every((oldIndex, position) => oldIndex === position)
}

/** 判断保存时动作列表是否还是用户排序时看到的那一份。 */
export function executionActionKey(action: OrderableAction | null | undefined): string {
  return String(action?.action_id || action?.source_action_id || action?.action_name || '')
}

export function reorderExecutionActions<T extends OrderableAction>(
  actions: T[],
  order: number[],
  options: { keepPlanIndex?: boolean } = {},
): T[] {
  return order.map((oldIndex, position) => {
    const action = actions[oldIndex]
    const next = { ...action, action_order: position + 1, action_index: position } as T
    // 计划训练靠 source_action_index 对回计划动作；缺失时读取方会退回数组下标，换序后就对错了。
    // 学员加的动作排到 actions.length 之后，保证不会占用任何计划下标。
    if (options.keepPlanIndex && !Number.isInteger(action.source_action_index)) {
      next.source_action_index = action.source === 'student_extra' ? actions.length + oldIndex : oldIndex
    }
    return next
  })
}

/** 把旧下标换算成新下标；不在 order 里时返回 -1。 */
export function remapActionIndex(index: number, order: number[]): number {
  return order.indexOf(index)
}

export function moveInActionOrder(order: number[], position: number, direction: 1 | -1): number[] {
  const target = position + direction
  if (position < 0 || position >= order.length || target < 0 || target >= order.length) return order
  const next = [...order]
  next[position] = order[target]
  next[target] = order[position]
  return next
}

/** 先往后找没练完的动作，后面没有再回头找；排到前面的动作不会被漏掉。 */
export function findNextOpenActionIndex(actions: OrderableAction[], fromIndex: number): number {
  const isOpen = (action: OrderableAction) => Number(action?.completed_sets || 0) < Number(action?.total_sets || 0)
  const after = actions.findIndex((action, index) => index > fromIndex && isOpen(action))
  if (after >= 0) return after
  return actions.findIndex((action, index) => index < fromIndex && isOpen(action))
}
