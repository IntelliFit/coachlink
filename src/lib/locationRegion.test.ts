import { describe, expect, it } from 'vitest'
import { getLocationProvince, getLocationRegionCountry, matchesLocationSearch, normalizeChinaProvince, splitLocationSearch } from '@coachlink/core'
import { listLocationProvinces, matchesLocationRegionFilters } from '../app/api/streetlifting-index/locations/regionFilter'

const peoplesPark = { name: '上海市人民公园健身区', country: null, province: '上海市', city: '上海市', county: '黄浦区', address: '南京西路231号人民公园内', description: null }

describe('China province normalization', () => {
  it.each([
    ['广东', '广东省'], ['广东省', '广东省'], ['北京是', '北京市'], ['安徽省淮南市', '安徽省'],
    ['内蒙古 呼和浩特市', '内蒙古自治区'], ['西安', '陕西省'], ['广州市', '广东省'],
    ['嘉兴市秀洲区高照街道', '浙江省'], ['阿尔山市', '内蒙古自治区'], ['香港特别行政区', '香港特别行政区'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeChinaProvince(raw)).toBe(expected)
  })

  it('returns null for unknown or overseas text', () => {
    expect(normalizeChinaProvince('Bavaria')).toBeNull()
    expect(normalizeChinaProvince('')).toBeNull()
  })

  it('keeps overseas provinces and falls back to address for Chinese rows', () => {
    expect(getLocationProvince({ country: '德国', province: 'Bayern' })).toBe('Bayern')
    expect(getLocationProvince({ country: '中国', province: null, address: '河南省郑州市二七区' })).toBe('河南省')
    expect(getLocationRegionCountry({ country: null, province: '西安' })).toBe('中国')
  })
})

describe('location keyword search', () => {
  it('matches district, name and multiple keywords', () => {
    expect(matchesLocationSearch(peoplesPark, '黄浦区')).toBe(true)
    expect(matchesLocationSearch(peoplesPark, '人民公园')).toBe(true)
    expect(matchesLocationSearch(peoplesPark, '上海 人民公园')).toBe(true)
    expect(matchesLocationSearch(peoplesPark, '黄浦区，人民公园')).toBe(true)
    expect(matchesLocationSearch(peoplesPark, '黄浦区 静安公园')).toBe(false)
  })

  it('treats short and full province names alike', () => {
    expect(matchesLocationSearch({ name: 'A', province: '广东', city: '深圳市' }, '广东省')).toBe(true)
    expect(matchesLocationSearch({ name: 'A', province: '上海市' }, '中国')).toBe(true)
  })

  it('splits on spaces and Chinese punctuation, ignoring empties', () => {
    expect(splitLocationSearch(' 上海、 人民公园 ;; ')).toEqual(['上海', '人民公园'])
  })
})

describe('region filters', () => {
  it('filters China + normalized province for legacy rows', () => {
    expect(matchesLocationRegionFilters(peoplesPark, { country: '中国', province: '上海市', search: '人民公园' })).toBe(true)
    expect(matchesLocationRegionFilters({ name: 'B', province: '上海' }, { country: '中国', province: '上海市' })).toBe(true)
    expect(matchesLocationRegionFilters({ name: 'C', country: '德国' }, { country: '中国' })).toBe(false)
  })

  it('collapses messy province text into one entry per province', () => {
    const rows = [{ province: '广东' }, { province: '广东省' }, { province: '广州市' }, { province: '北京是' }, { province: '北京市' }, { country: '德国', province: 'Bayern' }]
    expect(listLocationProvinces(rows, '中国')).toEqual(['北京市', '广东省'])
    expect(listLocationProvinces(rows)).toEqual(['北京市', '广东省', 'Bayern'])
  })
})
