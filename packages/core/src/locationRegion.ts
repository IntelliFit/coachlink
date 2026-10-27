import { getLocationCountry } from './locationCountry'

/** Canonical Chinese provincial-level names; the short forms are what people type. */
const CHINA_PROVINCES: Array<[short: string, full: string]> = [
  ['北京', '北京市'], ['天津', '天津市'], ['上海', '上海市'], ['重庆', '重庆市'],
  ['河北', '河北省'], ['山西', '山西省'], ['辽宁', '辽宁省'], ['吉林', '吉林省'],
  ['黑龙江', '黑龙江省'], ['江苏', '江苏省'], ['浙江', '浙江省'], ['安徽', '安徽省'],
  ['福建', '福建省'], ['江西', '江西省'], ['山东', '山东省'], ['河南', '河南省'],
  ['湖北', '湖北省'], ['湖南', '湖南省'], ['广东', '广东省'], ['海南', '海南省'],
  ['四川', '四川省'], ['贵州', '贵州省'], ['云南', '云南省'], ['陕西', '陕西省'],
  ['甘肃', '甘肃省'], ['青海', '青海省'], ['台湾', '台湾省'],
  ['内蒙古', '内蒙古自治区'], ['广西', '广西壮族自治区'], ['西藏', '西藏自治区'],
  ['宁夏', '宁夏回族自治区'], ['新疆', '新疆维吾尔自治区'],
  ['香港', '香港特别行政区'], ['澳门', '澳门特别行政区'],
]

/** Prefecture-level cities users have typed into the province field (plus provincial
 * capitals), so legacy rows land under the right province instead of a new one. */
const CHINA_CITY_PROVINCE: Record<string, string> = {
  石家庄: '河北省', 保定: '河北省', 唐山: '河北省', 张家口: '河北省', 秦皇岛: '河北省', 邯郸: '河北省', 廊坊: '河北省',
  太原: '山西省', 呼和浩特: '内蒙古自治区', 阿尔山: '内蒙古自治区', 包头: '内蒙古自治区',
  沈阳: '辽宁省', 大连: '辽宁省', 长春: '吉林省', 哈尔滨: '黑龙江省',
  南京: '江苏省', 苏州: '江苏省', 无锡: '江苏省', 常州: '江苏省', 徐州: '江苏省', 南通: '江苏省',
  杭州: '浙江省', 宁波: '浙江省', 温州: '浙江省', 嘉兴: '浙江省', 绍兴: '浙江省', 金华: '浙江省',
  合肥: '安徽省', 淮南: '安徽省', 芜湖: '安徽省', 福州: '福建省', 厦门: '福建省', 泉州: '福建省',
  南昌: '江西省', 济南: '山东省', 青岛: '山东省', 烟台: '山东省', 潍坊: '山东省',
  郑州: '河南省', 洛阳: '河南省', 武汉: '湖北省', 长沙: '湖南省',
  广州: '广东省', 深圳: '广东省', 东莞: '广东省', 佛山: '广东省', 惠州: '广东省', 珠海: '广东省', 中山: '广东省',
  南宁: '广西壮族自治区', 桂林: '广西壮族自治区', 海口: '海南省', 三亚: '海南省',
  成都: '四川省', 贵阳: '贵州省', 昆明: '云南省', 拉萨: '西藏自治区',
  西安: '陕西省', 兰州: '甘肃省', 西宁: '青海省', 银川: '宁夏回族自治区', 乌鲁木齐: '新疆维吾尔自治区',
}

function provinceFromText(text: string): string | null {
  const value = text.replace(/\s+/g, '').replace(/^中国/, '')
  if (!value) return null
  for (const [short, full] of CHINA_PROVINCES) {
    if (value.startsWith(short)) return full
  }
  for (const [city, province] of Object.entries(CHINA_CITY_PROVINCE)) {
    if (value.startsWith(city)) return province
  }
  return null
}

/** Maps free-text Chinese province input ("广东", "北京是", "安徽省淮南市", "西安")
 * to its canonical provincial-level name, or null when it cannot be recognized. */
export function normalizeChinaProvince(raw?: string | null): string | null {
  return provinceFromText(String(raw || ''))
}

type RegionInput = {
  country?: string | null
  province?: string | null
  city?: string | null
  address?: string | null
}

/** The province / state a location is grouped and filtered under. Chinese rows are
 * normalized (falling back to city and address); overseas rows keep their own text. */
export function getLocationProvince(location: RegionInput): string {
  const raw = String(location.province || '').trim()
  const country = getLocationCountry(location)
  if (country && country !== '中国') return raw
  const normalized = normalizeChinaProvince(raw)
    || normalizeChinaProvince(location.city)
    || normalizeChinaProvince(location.address)
  if (normalized) return normalized
  return country === '中国' ? '' : raw
}

/** Like getLocationCountry, but also recognizes legacy rows whose province field
 * holds a short or misspelt Chinese province/city name. */
export function getLocationRegionCountry(location: RegionInput): string {
  const country = getLocationCountry(location)
  if (country) return country
  return normalizeChinaProvince(location.province) ? '中国' : ''
}

/** Raw province values (as stored) that normalize to the selected province. */
export function getProvinceVariants(selected: string, rows: RegionInput[]): string[] {
  const target = selected.trim()
  const variants = new Set<string>([target])
  rows.forEach(row => {
    if (getLocationProvince(row) === target) variants.add(String(row.province ?? ''))
  })
  return Array.from(variants)
}

export function sortProvinces(provinces: string[]): string[] {
  const order = new Map(CHINA_PROVINCES.map(([, full], index) => [full, index]))
  return [...provinces].sort((a, b) => {
    const ai = order.get(a) ?? Number.MAX_SAFE_INTEGER
    const bi = order.get(b) ?? Number.MAX_SAFE_INTEGER
    return ai !== bi ? ai - bi : a.localeCompare(b)
  })
}

/** Splits a search box value into keywords: "上海 人民公园" and "上海，人民公园" both
 * mean "matches 上海 AND matches 人民公园". */
export function splitLocationSearch(search?: string | null): string[] {
  return Array.from(new Set(String(search || '').split(/[\s,，、;；]+/).map(token => token.trim()).filter(Boolean))).slice(0, 5)
}

export type LocationSearchInput = RegionInput & {
  name?: string | null
  county?: string | null
  description?: string | null
}

/** Every keyword must hit one of the location's text fields (incl. district) or its
 * normalized country / province. */
export function matchesLocationSearch(location: LocationSearchInput, search?: string | null): boolean {
  const tokens = splitLocationSearch(search)
  if (!tokens.length) return true
  const haystack = [
    location.name, location.country, getLocationRegionCountry(location), location.province, getLocationProvince(location),
    location.city, location.county, location.address, location.description,
  ].map(value => String(value || '').toLowerCase())
  return tokens.every(token => {
    const needle = token.toLowerCase()
    if (haystack.some(value => value.includes(needle))) return true
    // "广东省" should also find rows stored as "广东" (and vice versa).
    const province = getProvinceKeyword(token)
    return Boolean(province && getLocationProvince(location) === province)
  })
}

/** The canonical province when the keyword is exactly a province name, e.g. "广东" → "广东省". */
export function getProvinceKeyword(token: string): string | null {
  const value = token.replace(/\s+/g, '')
  return CHINA_PROVINCES.find(([short, full]) => value === short || value === full)?.[1] ?? null
}
