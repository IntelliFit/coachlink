import { describe, expect, it } from 'vitest'
import { inferLocationEquipment, matchesLocationEquipment, normalizeLocationEquipment, resolveLocationEquipment, validateLocationEquipment } from '@coachlink/core'
import { readEquipmentLocations } from '../app/api/streetlifting-index/locations/equipmentQuery'

describe('location equipment suggestions', () => {
  it('recognizes several equipment types at the same point', () => {
    expect(inferLocationEquipment({ description: '小区内有单双杠云梯' })).toEqual(['pullup_bar', 'parallel_bars', 'monkey_bars'])
  })
  it.each(['没双杠', '没有双杠', '无双杠', '双杠已拆除', '双杠，拆了', '没有单杠和双杠', '没有单杠、双杠'])('excludes absent equipment: %s', description => {
    expect(inferLocationEquipment({ description })).not.toContain('parallel_bars')
  })
  it.each(['好像有双杠', '如果有双杠', '可能有一个双杠', '忘了有没有双杠'])('leaves uncertain claims unclassified: %s', description => {
    expect(inferLocationEquipment({ description })).toEqual([])
  })
  it('does not apply a nearby negative to a different equipment type', () => {
    expect(inferLocationEquipment({ description: '粗单杠，没双杠，有云梯' })).toEqual(['pullup_bar', 'monkey_bars'])
    expect(inferLocationEquipment({ description: '只有单杠，没有双杠' })).toEqual(['pullup_bar'])
    expect(inferLocationEquipment({ description: '只有单杠，没有 双杠，有云梯' })).toEqual(['pullup_bar', 'monkey_bars'])
  })
  it('does not silently mark an undescribed location as a pull-up bar', () => {
    expect(resolveLocationEquipment({ name: '公园', description: '北门进去右转' })).toEqual({ equipment_types: [], equipment_source: 'unknown' })
  })
  it('keeps equipment type separate from poor condition', () => {
    expect(inferLocationEquipment({ description: '单杠生锈，双杠晃动' })).toEqual(['pullup_bar', 'parallel_bars'])
  })
  it('supports overseas English descriptions', () => {
    expect(inferLocationEquipment({ description: 'Pull-up bars and monkey bars, no parallel bars' })).toEqual(['pullup_bar', 'monkey_bars'])
  })
  it('retains manual corrections even when the old description disagrees', () => {
    expect(resolveLocationEquipment({ description: '有单杠双杠', equipment_types: ['monkey_bars'] })).toEqual({ equipment_types: ['monkey_bars'], equipment_source: 'confirmed' })
  })
  it('retains an explicitly cleared selection', () => {
    expect(resolveLocationEquipment({ description: '有单杠双杠', equipment_types: [] }).equipment_types).toEqual([])
  })
  it('distinguishes description suggestions from confirmed selections', () => {
    expect(resolveLocationEquipment({ description: '单杠双杠', equipment_types: null }).equipment_source).toBe('description')
  })
  it('requires all selected types, with empty selection meaning all', () => {
    const input = { description: '有单杠双杠' }
    expect(matchesLocationEquipment(input, [])).toBe(true)
    expect(matchesLocationEquipment(input, ['pullup_bar', 'parallel_bars'])).toBe(true)
    expect(matchesLocationEquipment(input, ['pullup_bar', 'monkey_bars'])).toBe(false)
  })
  it('rejects malformed inputs and normalizes duplicates/order', () => {
    expect(validateLocationEquipment('parallel_bars')).not.toBeNull()
    expect(validateLocationEquipment(['other'])).not.toBeNull()
    expect(normalizeLocationEquipment(['parallel_bars', 'pullup_bar', 'parallel_bars'])).toEqual(['pullup_bar', 'parallel_bars'])
  })
})

describe('equipment filtering across database pages', () => {
  it('includes matches beyond the first database batch before UI pagination', async () => {
    const source = Array.from({ length: 1010 }, (_, index) => ({ name: String(index), description: index >= 500 ? '有双杠' : '没有双杠' }))
    const ranges: number[] = []
    const result = await readEquipmentLocations((from, to) => {
      ranges.push(from)
      return Promise.resolve({ data: source.slice(from, to + 1), error: null })
    }, ['parallel_bars'])
    expect(ranges).toEqual([0, 500, 1000])
    expect(result.length).toBe(510)
    expect(result.slice(0, 30)[0].name).toBe('500')
    expect(result.slice(30, 60)[0].name).toBe('530')
  })
  it('does not turn a partial database failure into a successful empty list', async () => {
    await expect(readEquipmentLocations(() => Promise.resolve({ data: null, error: { message: 'read failed' } }), ['monkey_bars'])).rejects.toThrow('read failed')
  })
})
