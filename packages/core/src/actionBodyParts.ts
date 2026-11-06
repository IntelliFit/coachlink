/**
 * 动作名里有些固定说法单看字会被关键词规则判错：「腿弯举」含「弯举」会算成手臂，
 * 「悬垂举腿」含「腿」会算成腿部。各处的部位关键词规则匹配前先过这一步：
 * 命中的说法直接定部位，并从文本里去掉，剩下的文本再按原来的关键词匹配。
 */

export type ActionBodyPartLabel = '胸部' | '背部' | '肩部' | '手臂' | '核心' | '腿部' | '臀部'

/** 按长度从长到短检查，长的说法先于它包含的短说法（「侧卧抬腿」先于「抬腿」）。 */
const BODY_PART_PHRASES: Array<{ phrase: string; part: ActionBodyPartLabel }> = [
  { phrase: '侧卧抬腿', part: '臀部' },
  { phrase: '侧卧举腿', part: '臀部' },
  { phrase: '侧抬腿', part: '臀部' },
  { phrase: '腿弯举', part: '腿部' },
  { phrase: '腿屈伸', part: '腿部' },
  { phrase: '提踵', part: '腿部' },
  { phrase: '举腿', part: '核心' },
  { phrase: '抬腿', part: '核心' },
]

export function splitActionBodyPartPhrases(text: string): { rest: string; parts: ActionBodyPartLabel[] } {
  let rest = String(text || '')
  const parts: ActionBodyPartLabel[] = []
  for (const { phrase, part } of BODY_PART_PHRASES) {
    if (!rest.includes(phrase)) continue
    rest = rest.split(phrase).join(' ')
    if (!parts.includes(part)) parts.push(part)
  }
  return { rest, parts }
}

/** 部位标签和各处筛选项 key 的对应，用于把命中的说法算进对应筛选项。 */
const BODY_PART_FILTER_KEYS: Record<ActionBodyPartLabel, string> = {
  胸部: 'chest',
  背部: 'back',
  肩部: 'shoulder',
  手臂: 'arms',
  核心: 'core',
  腿部: 'legs',
  臀部: 'glutes',
}

/** 部位筛选：命中固定说法的按说法定，其余按该筛选项自己的关键词匹配。 */
export function matchesBodyPartFilter(text: string, filter: { key: string; keywords: readonly string[] }): boolean {
  const { rest, parts } = splitActionBodyPartPhrases(String(text || '').toLowerCase())
  if (parts.some((part) => BODY_PART_FILTER_KEYS[part] === filter.key)) return true
  return filter.keywords.some((keyword) => rest.includes(keyword.toLowerCase()))
}

/** 部位推断：固定说法定的部位，加上剩余文本按 rules 命中的部位。 */
export function inferActionBodyParts(
  text: string,
  rules: ReadonlyArray<{ label: string; keywords: readonly string[] }>,
): string[] {
  const { rest, parts } = splitActionBodyPartPhrases(text)
  const labels: string[] = [...parts]
  for (const rule of rules) {
    if (!labels.includes(rule.label) && rule.keywords.some((keyword) => rest.includes(keyword))) labels.push(rule.label)
  }
  return labels
}
