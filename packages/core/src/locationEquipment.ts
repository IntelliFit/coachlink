export const LOCATION_EQUIPMENT_OPTIONS = [
  { code: 'pullup_bar', label: '单杠' },
  { code: 'parallel_bars', label: '双杠' },
  { code: 'monkey_bars', label: '云梯' }
] as const

export type LocationEquipmentType = typeof LOCATION_EQUIPMENT_OPTIONS[number]['code']
export type LocationEquipmentSource = 'confirmed' | 'description' | 'unknown'
export type LocationEquipmentInput = {
  name?: string | null
  description?: string | null
  equipment_types?: LocationEquipmentType[] | null
  equipment_source?: LocationEquipmentSource
}

export function normalizeLocationEquipment(value: unknown): LocationEquipmentType[] {
  return LOCATION_EQUIPMENT_OPTIONS.filter(item => Array.isArray(value) && value.includes(item.code)).map(item => item.code)
}

export function validateLocationEquipment(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value) || value.length > LOCATION_EQUIPMENT_OPTIONS.length || value.some(item => !LOCATION_EQUIPMENT_OPTIONS.some(option => option.code === item))) {
    return '请选择支持的器材类型'
  }
  return null
}

const EQUIPMENT_PATTERNS: Record<LocationEquipmentType, string> = {
  pullup_bar: '单双杠|单杠|引体向上架|pull[ -]?up\\s+bars?|horizontal\\s+bars?',
  parallel_bars: '单双杠|双杠|parallel\\s+bars?|dip\\s+bars?',
  monkey_bars: '云梯|猴架|monkey\\s+bars?|horizontal\\s+ladders?'
}

// Suggestions only: silence is unknown, negations and uncertain statements are
// excluded. This never infers equipment from coordinates or changes old text.
export function inferLocationEquipment(input: Pick<LocationEquipmentInput, 'name' | 'description'>): LocationEquipmentType[] {
  const text = [input.name, input.description].filter(Boolean).join('。')
  return LOCATION_EQUIPMENT_OPTIONS.filter(option => {
    const expression = new RegExp(EQUIPMENT_PATTERNS[option.code], 'gi')
    let positive = false
    let excluded = false
    let match: RegExpExecArray | null
    while ((match = expression.exec(text))) {
      const before = text.slice(Math.max(0, match.index - 40), match.index)
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 24)
      const directNegative = /(?:没(?:有)?|无|不设|缺少|缺乏|不存在|不含|no|without)\s*(?:任何|一个|一副|一套|设置|配置|安装)?\s*$/i.test(before)
      const negativeList = /(?:没有|没|无|缺少|不设)\s*(?:(?:单杠|双杠|云梯|单双杠)\s*[,，、和及与或]\s*)+$/i.test(before)
      const removed = /^[\s，,:：]*(?:已(?:经)?|全(?:部)?|都)?\s*(?:缺失|拆除|拆了|被拆|已撤|not\s+present)/i.test(after)
        || /^[\s，,:：]*(?:已(?:经)?|全(?:部)?|都)?\s*(?:没有(?:了)?|没了|不存在)(?=\s*(?:$|[，。、；;.!！]|但|不过))/i.test(after)
      const uncertain = /(?:无论|如果有|如果|可能有|好像有|似乎有|据说有|不确定有没有|忘了有没有|自带|携带|想要|希望|需要|建议|可装|可以装|适合装)\s*(?:那种|这种|一个|一些|一组|一套)?\s*$/i.test(before)
      if (directNegative || negativeList || removed || uncertain) excluded = true
      else positive = true
    }
    return positive && !excluded
  }).map(option => option.code)
}

export function resolveLocationEquipment(input: LocationEquipmentInput): { equipment_types: LocationEquipmentType[]; equipment_source: LocationEquipmentSource } {
  if (Array.isArray(input.equipment_types)) {
    return { equipment_types: normalizeLocationEquipment(input.equipment_types), equipment_source: input.equipment_source || 'confirmed' }
  }
  const equipment_types = inferLocationEquipment(input)
  return { equipment_types, equipment_source: equipment_types.length ? 'description' : 'unknown' }
}

export function withLocationEquipment<T extends LocationEquipmentInput>(input: T) {
  return { ...input, ...resolveLocationEquipment(input) }
}

export function matchesLocationEquipment(input: LocationEquipmentInput, selected: LocationEquipmentType[]): boolean {
  const available = resolveLocationEquipment(input).equipment_types
  return selected.every(type => available.includes(type))
}

export function locationEquipmentLabel(type: LocationEquipmentType): string {
  return LOCATION_EQUIPMENT_OPTIONS.find(option => option.code === type)?.label || type
}
