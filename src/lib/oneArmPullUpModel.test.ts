import {
  calculateOneArmPullUpReadiness,
  getOneArmPullUpReadinessLevel,
} from '../../apps/mobile/src/screens/toolbox/oneArmPullUpModel'

describe('one-arm pull-up readiness model', () => {
  it('matches the mini-program 0.8 bodyweight target model', () => {
    const result = calculateOneArmPullUpReadiness(70, 40)
    expect(result).not.toBeNull()
    expect(result?.targetAdditionalWeight).toBe(56)
    expect(result?.progress).toBeCloseTo(71.428, 2)
    expect(result?.gap).toBe(16)
    expect(result?.level.name).toBe('单侧过渡期')
  })

  it('uses exact readiness boundaries', () => {
    expect(getOneArmPullUpReadinessLevel(0.24).name).toBe('基础力量期')
    expect(getOneArmPullUpReadinessLevel(0.25).name).toBe('负重积累期')
    expect(getOneArmPullUpReadinessLevel(0.48).name).toBe('单侧过渡期')
    expect(getOneArmPullUpReadinessLevel(0.68).name).toBe('专项冲刺期')
    expect(getOneArmPullUpReadinessLevel(0.8).name).toBe('理论门槛已达到')
  })

  it('caps visual progress but preserves over-target result', () => {
    const result = calculateOneArmPullUpReadiness(60, 60)
    expect(result?.progress).toBe(125)
    expect(result?.progressWidth).toBe(100)
    expect(result?.gap).toBe(0)
    expect(result?.equivalentDelta).toBeCloseTo(6.666, 2)
  })

  it('rejects invalid measurements', () => {
    expect(calculateOneArmPullUpReadiness(0, 20)).toBeNull()
    expect(calculateOneArmPullUpReadiness(70, -1)).toBeNull()
    expect(calculateOneArmPullUpReadiness(Number.NaN, 20)).toBeNull()
  })
})
