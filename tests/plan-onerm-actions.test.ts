import { describe, expect, it } from 'vitest'
import { selectPlanOneRMActions } from '../src/app/me/plan-lib/components/planOneRMActions'

const strengthDefaults = ['组数', '次数', '强度', '休息时间']

const action = (id: string, name: string, enableAutoWeightCompute: boolean | null) =>
  ({ id, name, type: 'STRENGTH', attrs: strengthDefaults, enableAutoWeightCompute }) as any

describe('selectPlanOneRMActions', () => {
  const actions = [
    action('squat', '杠铃深蹲', true),
    action('deadbug', '死虫', null),
    action('pushup', '俯卧撑', false),
    action('bench', '卧推', true),
    action('row', '杠铃划船', true)
  ]

  it('keeps only eligible actions whose sets are prescribed as RM or %1RM', () => {
    const days = [
      {
        dayIndex: 1,
        type: 'training',
        note: '',
        actionSets: [
          { type: 'no-filter', actionId: 'squat', params: { intensity: '75%' } },
          { type: 'no-filter', actionId: 'deadbug', params: { intensity: '8RM' } },
          { type: 'no-filter', actionId: 'pushup', params: { 强度: 5 } },
          { type: 'no-filter', actionId: 'bench', params: { intensity: 'RPE 7' } }
        ]
      }
    ] as any
    expect(selectPlanOneRMActions(days, actions).map((a) => a.id)).toEqual(['squat'])
  })

  it('falls back to actionName matching and skips rest days', () => {
    const days = [
      { dayIndex: 1, type: 'rest', note: '', actionSets: [{ actionName: '卧推', params: { intensity: '5RM' } }] },
      { dayIndex: 2, type: 'training', note: '', actionSets: [{ actionName: ' 杠铃划船 ', params: { intensity: '8RM' } }] }
    ] as any
    expect(selectPlanOneRMActions(days, actions).map((a) => a.id)).toEqual(['row'])
  })
})
