import { describe, expect, it } from 'vitest'
import { DEFAULT_MOTION_PRICES, formatMotionPrice, motionEffectPriceCents } from '../../apps/mobile/src/screens/toolbox/motionEffectsModel'

describe('motion effect export price (same as the mini-program)', () => {
  const prices = DEFAULT_MOTION_PRICES

  it('makes the first standard export free for signed-up users', () => {
    expect(motionEffectPriceCents({ quality: 'standard', tier: 'standard', prices, signupFreeAvailable: true })).toBe(0)
    expect(motionEffectPriceCents({ quality: 'standard', tier: 'standard', prices, signupFreeAvailable: false })).toBe(290)
  })

  it('charges HD and priority even when the free export is available', () => {
    expect(motionEffectPriceCents({ quality: 'hd', tier: 'standard', prices, signupFreeAvailable: true })).toBe(490)
    expect(motionEffectPriceCents({ quality: 'standard', tier: 'priority', prices, signupFreeAvailable: true })).toBe(190)
    expect(motionEffectPriceCents({ quality: 'hd', tier: 'priority', prices, signupFreeAvailable: false })).toBe(680)
  })

  it('formats yuan with one decimal', () => {
    expect(formatMotionPrice(290)).toBe('¥2.9')
    expect(formatMotionPrice(680)).toBe('¥6.8')
  })
})
