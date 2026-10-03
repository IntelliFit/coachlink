import { afterEach, describe, expect, it, vi } from 'vitest'
const precise = vi.hoisted(() => vi.fn())
vi.mock('@tarojs/taro', () => ({ default: { getLocation: precise } }))
import { getApproxUserLocation } from '../../apps/wechat/src/utils/approxLocation'
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('declared approximate location API', () => {
  it('uses native wx fuzzy location when the Taro wrapper is absent', async () => {
    const fuzzy = vi.fn(options => options.success({ latitude: 22.3, longitude: 114.1 }))
    vi.stubGlobal('wx', { getFuzzyLocation: fuzzy })
    expect(await getApproxUserLocation()).toEqual({ latitude: 22.3, longitude: 114.1 })
    expect(fuzzy.mock.calls[0][0].type).toBe('gcj02')
    expect(precise).not.toHaveBeenCalled()
  })
  it('never falls back to the undeclared precise permission', async () => {
    vi.stubGlobal('wx', {})
    await expect(getApproxUserLocation()).rejects.toThrow('附近定位不可用')
    expect(precise).not.toHaveBeenCalled()
  })
  it('rejects invalid provider coordinates without moving the map', async () => {
    vi.stubGlobal('wx', { getFuzzyLocation: options => options.success({ latitude: 91, longitude: 0 }) })
    await expect(getApproxUserLocation()).rejects.toThrow('附近定位不可用')
  })
})
