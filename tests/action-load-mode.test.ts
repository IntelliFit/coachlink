import { describe, expect, it } from 'vitest'
import {
  collectPlanOneRMActionIds,
  isOneRMEligibleAction,
  resolveActionLoadMode,
  usesRelativeIntensity
} from '../packages/core/src/actionLoadMode'

const strengthDefaults = ['组数', '次数', '强度', '休息时间']

describe('isOneRMEligibleAction', () => {
  it('rejects copied core moves that only carry the generic 强度 parameter attr', () => {
    expect(isOneRMEligibleAction({ name: '死虫', type: 'STRENGTH', attrs: strengthDefaults, enableAutoWeightCompute: false })).toBe(false)
    expect(isOneRMEligibleAction({ name: '俯卧撑', type: 'STRENGTH', attrs: strengthDefaults, enableAutoWeightCompute: null })).toBe(false)
  })

  it('mirrors the server rule: strength + 强度 attr + auto weight enabled', () => {
    expect(isOneRMEligibleAction({ type: 'STRENGTH', attrs: strengthDefaults, enableAutoWeightCompute: true })).toBe(true)
    expect(isOneRMEligibleAction({ type: 'CARDIO', attrs: strengthDefaults, enableAutoWeightCompute: true })).toBe(false)
    expect(isOneRMEligibleAction({ type: 'STRENGTH', attrs: ['哑铃'], enableAutoWeightCompute: true })).toBe(false)
    expect(isOneRMEligibleAction(null)).toBe(false)
  })
})

describe('usesRelativeIntensity', () => {
  it('is false for RPE and descriptive cues used by the free plans', () => {
    expect(usesRelativeIntensity({ params: { reps: '8-10', sets: 3, intensity: 'RPE 6-7' } })).toBe(false)
    expect(usesRelativeIntensity({ params: { 强度: '腰背贴地', 次数: '8-10/侧' } })).toBe(false)
    expect(usesRelativeIntensity({ params: { reps: '8-10' } })).toBe(false)
  })

  it('is true for RM, %1RM, legacy numeric 强度 and structured config', () => {
    expect(usesRelativeIntensity({ params: { intensity: '8RM' } })).toBe(true)
    expect(usesRelativeIntensity({ params: { intensity: '75%' } })).toBe(true)
    expect(usesRelativeIntensity({ params: { 强度: 5 } })).toBe(true)
    expect(usesRelativeIntensity({ params: { intensityConfig: { relativeIntensity: { type: 'percentage', value: 70 } } } })).toBe(true)
  })
})

describe('collectPlanOneRMActionIds', () => {
  it('only returns actions whose sets prescribe RM or %1RM, including one-filter children', () => {
    const days = [
      { type: 'rest', actionSets: [{ actionId: 'ignored', params: { intensity: '5RM' } }] },
      {
        type: 'training',
        actionSets: [
          { actionId: 'squat', params: { intensity: '75%' } },
          { actionId: 'deadbug', params: { intensity: 'RPE 6-7' } },
          { type: 'one-filter', actions: [{ action_id: 'press', params: { 强度: 8 } }] }
        ]
      }
    ]
    expect(Array.from(collectPlanOneRMActionIds(days)).sort()).toEqual(['press', 'squat'])
    expect(collectPlanOneRMActionIds(undefined).size).toBe(0)
  })
})

describe('resolveActionLoadMode', () => {
  it('defaults core and bodyweight moves to bodyweight', () => {
    expect(resolveActionLoadMode({ name: '死虫', attrs: strengthDefaults })).toBe('bodyweight')
    expect(resolveActionLoadMode({ name: '俯卧撑', attrs: strengthDefaults })).toBe('bodyweight')
    expect(resolveActionLoadMode({ name: '平板支撑', attrs: ['核心', '稳定'] })).toBe('bodyweight')
  })

  it('treats equipment names and equipment attrs as weighted', () => {
    expect(resolveActionLoadMode({ name: '哑铃推举', attrs: strengthDefaults })).toBe('weighted')
    expect(resolveActionLoadMode({ name: '高脚杯深蹲' })).toBe('weighted')
    expect(resolveActionLoadMode({ name: '杠铃卧推' })).toBe('weighted')
    expect(resolveActionLoadMode({ name: '高位下拉' })).toBe('weighted')
    expect(resolveActionLoadMode({ name: '深蹲', attrs: ['杠铃'] })).toBe('weighted')
  })

  it('does not mistake 单杠 (pull-up bar) for a barbell', () => {
    expect(resolveActionLoadMode({ name: '单杠悬垂', attrs: ['自重'] })).toBe('bodyweight')
  })

  it('uses auto-weight flag, planned kg and recorded kg as weighted signals', () => {
    expect(resolveActionLoadMode({ name: '引体向上', enableAutoWeightCompute: true })).toBe('weighted')
    expect(resolveActionLoadMode({ name: '俯卧撑' }, { plannedWeights: ['10kg'] })).toBe('weighted')
    expect(resolveActionLoadMode({ name: '俯卧撑' }, { recordedWeights: [5] })).toBe('weighted')
  })

  it('ignores RM/% planned weights and zero recorded weights', () => {
    expect(resolveActionLoadMode({ name: '俯卧撑' }, { plannedWeights: ['8RM', '75%', null, ''] })).toBe('bodyweight')
    expect(resolveActionLoadMode({ name: '俯卧撑' }, { recordedWeights: [0, null, undefined] })).toBe('bodyweight')
  })
})

describe('isOneRMEligibleAction field aliases', () => {
  it('accepts snake_case and lowercase auto-weight flags from legacy rows', () => {
    expect(isOneRMEligibleAction({ attrs: ['强度'], enable_auto_weight_compute: true })).toBe(true)
    expect(isOneRMEligibleAction({ attrs: ['强度'], enableautoweightcompute: true })).toBe(true)
    expect(isOneRMEligibleAction({ attrs: ['强度'], enableAutoWeightCompute: false, enable_auto_weight_compute: true })).toBe(false)
  })
})
