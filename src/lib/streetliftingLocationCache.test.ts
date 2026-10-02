import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const storage = vi.hoisted(() => new Map<string, unknown>())
vi.mock('@tarojs/taro', () => ({ default: {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => storage.set(key, value),
} }))
import { readLocationCache, writeLocationCache } from '../../apps/wechat/src/utils/streetliftingLocationCache'

describe('single source location cache', () => {
  beforeEach(() => { storage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T00:00:00Z')) })
  afterEach(() => { storage.clear(); vi.useRealTimers() })
  it('reads recent cached data and lets cloud data replace it', () => {
    writeLocationCache('list:UK', { country: '英国', count: 1 })
    expect(readLocationCache('list:UK')).toEqual({ country: '英国', count: 1 })
    writeLocationCache('list:UK', { country: '英国', count: 2 })
    expect(readLocationCache('list:UK')).toEqual({ country: '英国', count: 2 })
  })
  it('expires data after 60 days and prunes it on the next write', () => {
    writeLocationCache('list:old', { count: 1 })
    vi.advanceTimersByTime(60 * 24 * 60 * 60 * 1000 + 1)
    expect(readLocationCache('list:old')).toBeNull()
    writeLocationCache('list:new', { count: 2 })
    expect(Object.keys(storage.get('streetlifting_location_cache_v1') as object)).toEqual(['list:new'])
  })
  it('keeps drafts separated by user and clears only the synchronized draft', () => {
    writeLocationCache('draft:a', { latitude: -33.8688 })
    writeLocationCache('draft:b', { longitude: -0.1278 })
    writeLocationCache('draft:a', null)
    expect(readLocationCache('draft:a')).toBeNull()
    expect(readLocationCache('draft:b')).toEqual({ longitude: -0.1278 })
  })
  it('bounds list cache size without discarding pending drafts', () => {
    writeLocationCache('draft:a', { name: 'pending' })
    for (let index = 0; index < 30; index++) { vi.advanceTimersByTime(1); writeLocationCache(`list:${index}`, { index }) }
    const entries = storage.get('streetlifting_location_cache_v1') as object
    expect(Object.keys(entries).filter(key => key.startsWith('list:'))).toHaveLength(20)
    expect(readLocationCache('draft:a')).toEqual({ name: 'pending' })
  })
})
