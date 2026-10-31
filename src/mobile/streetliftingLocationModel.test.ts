import { describe, expect, it } from 'vitest'
import {
  EMPTY_LOCATION_FORM,
  applyPlaceSelection,
  buildLocationPayload,
  contributorLabel,
  currentContributorContact,
  formHasPosition,
  formatContributorName,
  formatMonthLabel,
  formatRate,
  initialEquipment,
  locationFormFromLocation,
  locationRegion,
  parseFormPosition,
  sortLocations,
  validateLocationForm,
  withoutLocation,
  type StreetliftingLocation,
} from '../../apps/mobile/src/screens/streetlifting/locationModel'

const place = {
  id: 'p1',
  zoom: 16,
  name: '学知园',
  address: '学院路 · 海淀区 · 北京市 · 中国',
  country: '中国',
  province: '北京市',
  city: '北京市',
  county: '海淀区',
  latitude: 39.98,
  longitude: 116.35,
  coordinate_system: 'wgs84' as const,
}

function location(overrides: Partial<StreetliftingLocation> = {}): StreetliftingLocation {
  return {
    id: 'l1',
    name: '学知园单杠',
    description: null,
    address: null,
    country: null,
    city: null,
    province: null,
    county: null,
    image_url: null,
    image_urls: null,
    latitude: null,
    longitude: null,
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

describe('contributor names are masked like the mini-program', () => {
  it('never shows a raw phone number or email', () => {
    expect(formatContributorName('13812345678')).toBe('138****5678')
    expect(formatContributorName('zhangsan@qq.com')).toBe('zh***@qq.com')
    expect(formatContributorName('ab@qq.com')).toBe('a*@qq.com')
    expect(formatContributorName('荧光棒')).toBe('荧光棒')
    expect(formatContributorName('  ')).toBe('未署名贡献者')
    expect(contributorLabel({ contributor_name_snapshot: null, user_contact: '13812345678' })).toBe('138****5678')
  })

  it('signs uploads with the nickname first', () => {
    expect(currentContributorContact({ nickname: '小明', phone: '13812345678' })).toBe('小明')
    expect(currentContributorContact({ phone: '13812345678' })).toBe('13812345678')
    expect(currentContributorContact(null)).toBeNull()
  })
})

describe('location form', () => {
  it('fills an empty form from a place result and tags the coordinates as WGS84', () => {
    const { form, autoFilled } = applyPlaceSelection(EMPTY_LOCATION_FORM, place)
    expect(form).toMatchObject({ name: '学知园', address: place.address, province: '北京市', county: '海淀区', latitudeText: '39.98', longitudeText: '116.35', coordinate_system: 'wgs84' })
    expect(autoFilled.name).toBe('学知园')
    expect(formHasPosition(form)).toBe(true)
  })

  it('replaces earlier automatic text but keeps what the user corrected', () => {
    const first = applyPlaceSelection(EMPTY_LOCATION_FORM, place)
    const corrected = { ...first.form, name: '学知园北门单杠' }
    const second = applyPlaceSelection(corrected, { ...place, name: '别的公园', address: '成府路 · 海淀区', county: '朝阳区' }, first.autoFilled)
    expect(second.form.name).toBe('学知园北门单杠')
    expect(second.form.address).toBe('成府路 · 海淀区')
    expect(second.form.county).toBe('朝阳区')
  })

  it('does not treat a bare administrative area as a detailed address', () => {
    const { form } = applyPlaceSelection(EMPTY_LOCATION_FORM, { ...place, address: '海淀区 · 北京市 · 中国' })
    expect(form.address).toBe('')
  })

  it('validates required fields and half-filled coordinates', () => {
    expect(validateLocationForm(EMPTY_LOCATION_FORM)).toBe('请填写地点名称')
    expect(validateLocationForm({ ...EMPTY_LOCATION_FORM, name: 'a', country: ' ' })).toBe('请填写国家/地区')
    expect(validateLocationForm({ ...EMPTY_LOCATION_FORM, name: 'a', latitudeText: '39.9' })).toContain('有效经纬度')
    expect(validateLocationForm({ ...EMPTY_LOCATION_FORM, name: 'a', latitudeText: '100', longitudeText: '116' })).toContain('有效经纬度')
    expect(validateLocationForm({ ...EMPTY_LOCATION_FORM, name: 'a' })).toBeNull()
    expect(parseFormPosition({ ...EMPTY_LOCATION_FORM, latitudeText: '-33.8', longitudeText: '151.2' })).toEqual({ latitude: -33.8, longitude: 151.2 })
  })

  it('builds the same payload fields as the mini-program', () => {
    const form = { ...EMPTY_LOCATION_FORM, name: ' 单杠 ', latitudeText: '39.9', longitudeText: '116.3', coordinate_system: 'wgs84' as const }
    expect(buildLocationPayload(form, ['a.jpg'], { types: ['pullup_bar'], touched: true })).toMatchObject({
      name: '单杠', country: '中国', equipment_types: ['pullup_bar'], latitude: 39.9, longitude: 116.3, coordinate_system: 'wgs84', description: null, image_urls: ['a.jpg'],
    })
    const untouched = buildLocationPayload({ ...EMPTY_LOCATION_FORM, name: '单杠' }, [], { types: [], touched: false })
    expect(untouched.equipment_types).toBeUndefined()
    expect(untouched.image_urls).toBeNull()
    expect(untouched.coordinate_system).toBeNull()
    expect(buildLocationPayload({ ...EMPTY_LOCATION_FORM, name: '单杠' }, [], { types: [], touched: true }).equipment_types).toEqual([])
  })

  it('reads an existing location, keeping its coordinate system and confirmed equipment', () => {
    const existing = location({ province: '北京市', latitude: 39.9, longitude: 116.3, coordinate_system: 'gcj02', equipment_types: ['parallel_bars'], equipment_source: 'confirmed' })
    const form = locationFormFromLocation(existing)
    expect(form).toMatchObject({ country: '中国', latitudeText: '39.9', longitudeText: '116.3', coordinate_system: 'gcj02' })
    expect(initialEquipment(existing, form)).toEqual({ types: ['parallel_bars'], touched: true })
    expect(locationFormFromLocation(location({ latitude: 0, longitude: 0 })).latitudeText).toBe('0')
  })

  it('preselects equipment from the name for a new location without marking it confirmed', () => {
    expect(initialEquipment(null, { ...EMPTY_LOCATION_FORM, name: '公园双杠' })).toEqual({ types: ['parallel_bars'], touched: false })
  })
})

describe('location lists', () => {
  it('sorts by image count, then newest', () => {
    const sorted = sortLocations([
      location({ id: 'old', created_at: '2026-01-01T00:00:00Z' }),
      location({ id: 'new', created_at: '2026-06-01T00:00:00Z' }),
      location({ id: 'photos', image_urls: ['a', 'b'], created_at: '2025-01-01T00:00:00Z' }),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['photos', 'new', 'old'])
  })

  it('removes a deleted point from the totals', () => {
    const data = {
      locations: [{ ...location({ id: 'a', image_urls: ['x', 'y'] }), gaps: ['position' as const] }, { ...location({ id: 'b' }), gaps: [] }],
      summary: { upload_count: 2, image_count_total: 2, needs_update_count: 1, contribution_score: 10, rank: 3 },
    }
    expect(withoutLocation(data, 'a').summary).toEqual({ upload_count: 1, image_count_total: 0, needs_update_count: 0, contribution_score: 10, rank: 3 })
    expect(withoutLocation(data, 'missing')).toBe(data)
  })

  it('formats region, rate and month', () => {
    expect(locationRegion({ province: '北京市', city: '北京市', county: '海淀区', address: null })).toBe('北京市 · 海淀区')
    expect(locationRegion({ province: null, city: null, county: null, address: '某路' })).toBe('某路')
    expect(formatRate(1, 4)).toBe('25%')
    expect(formatRate(1, 0)).toBe('0%')
    expect(formatMonthLabel('2026-10')).toBe('10月')
  })
})

describe('calculator history and result feedback', () => {
  const record = { id: 'r1', exerciseType: 'bench' as const, reps: 5, estimated1RMKg: 100.25, finalScore: 412.37, adjustedUsedWeightKg: 88, resultLevel: '进阶', createdAt: '2026-10-30T00:05:00Z' }

  it('formats scores per scoring system', async () => {
    const { calcRecordMeta, calcScoreDecimals, formatCalcDate, formatCalcRecordScore, isCalcExerciseType } = await import('../../apps/mobile/src/screens/streetlifting/calculatorSummary')
    expect(calcScoreDecimals('weighted_pullup')).toBe(0)
    expect(calcScoreDecimals('bench')).toBe(1)
    expect(formatCalcRecordScore(record, 'bench')).toBe('412.4')
    expect(formatCalcRecordScore(record, 'weighted_dips')).toBe('412')
    expect(formatCalcRecordScore(null, 'bench')).toBe('--')
    expect(calcRecordMeta(record)).toBe('1RM 100.3 kg · 5 次 · 计算重量 88.0 kg')
    expect(calcRecordMeta({ ...record, reps: null, adjustedUsedWeightKg: null })).toBe('1RM 100.3 kg')
    expect(formatCalcDate(record.createdAt)).toBe('10.30 08:05')
    expect(isCalcExerciseType('squat')).toBe(true)
    expect(isCalcExerciseType('nope')).toBe(false)
  })

  it('explains the fun ranking and the change since last time', async () => {
    const { calcDeltaTexts, calcRankingText } = await import('../../apps/mobile/src/screens/streetlifting/calculatorSummary')
    const ranking = { eligible: true, rank: 3, percentile: 80, totalParticipants: 15 }
    const summary = { latestRecord: record, previousRecord: null, personalBestRecord: record, deltaScore: 2.5, delta1RMKg: -1.25, ranking }
    expect(calcRankingText(summary)).toBe('第 3 名 · 超过 80% 用户')
    expect(calcRankingText({ ...summary, ranking: { ...ranking, eligible: false, notice: '反推不参与' } })).toBe('反推不参与')
    expect(calcRankingText({ ...summary, ranking: { ...ranking, rank: null } })).toBe('暂无排名')
    expect(calcRankingText(null)).toBe('暂无排名')
    expect(calcDeltaTexts(summary, 'bench')).toEqual({ score: '+2.5', oneRm: '1RM -1.3 kg' })
    expect(calcDeltaTexts({ ...summary, deltaScore: null, delta1RMKg: null }, 'bench')).toEqual({ score: '--', oneRm: '这是当前动作的首条记录' })
  })
})
