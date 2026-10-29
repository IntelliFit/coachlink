import { describe, expect, it } from 'vitest'
import {
  buildLightTaskCustomData,
  initialLightTaskForm,
  lightTaskType,
  removeActionAt,
  studentExtraTasks,
} from '../../apps/mobile/src/screens/training/lightTaskModel'

describe('mobile light tasks (same payload as the mini-program today page)', () => {
  it('recognizes only diet, cardio and habit actions', () => {
    expect(lightTaskType({ type: 'cardio' })).toBe('CARDIO')
    expect(lightTaskType({ type: 'STRENGTH' })).toBeNull()
    expect(lightTaskType(null)).toBeNull()
  })

  it('prefills from the action defaults with mini-program units', () => {
    const form = initialLightTaskForm({ type: 'CARDIO', name: '慢跑', attrs: { suggested_time: '07:00', custom_data: { distance: 5000, duration: 1800, pace: '6\'00"' } } })
    expect(form).toMatchObject({ suggestedTime: '07:00', cardioDistanceKm: '5', cardioDurationMin: '30', cardioPace: '6\'00"' })
    expect(initialLightTaskForm({ type: 'HABIT', name: '拉伸' }).habitName).toBe('拉伸')
  })

  it('stores cardio distance in meters and duration in seconds', () => {
    const form = { ...initialLightTaskForm({ type: 'CARDIO' }), cardioDistanceKm: '2.5', cardioDurationMin: '20' }
    expect(buildLightTaskCustomData('CARDIO', form, '跑步')).toEqual({ distance: 2500, duration: 1200, pace: undefined })
    const habit = { ...initialLightTaskForm({ type: 'HABIT' }), habitName: '', habitTargetMin: '10' }
    expect(buildLightTaskCustomData('HABIT', habit, '冥想')).toEqual({ habit_name: '冥想', target_duration: 10 })
    expect(buildLightTaskCustomData('DIET', { ...habit, dietContent: '  ' }, '早餐')).toEqual({ content: undefined })
  })

  it('removes a deleted item locally so the next delete uses the new indexes', () => {
    const execution = {
      id: 'e1',
      total_sets: 5,
      completed_sets: 2,
      action_executions: [
        { action_name: '深蹲', source: 'plan', total_sets: 3, completed_sets: 2 },
        { action_name: '早餐', source: 'student_extra', total_sets: 1, completed_sets: 0 },
        { action_name: '拉伸', source: 'student_extra', total_sets: 1, completed_sets: 0 },
      ],
    }
    const next = removeActionAt(execution, 1)!
    expect(next.action_executions.map((item: any) => item.action_name)).toEqual(['深蹲', '拉伸'])
    expect(next).toMatchObject({ total_sets: 4, completed_sets: 2 })
    expect(studentExtraTasks(next)).toEqual([{ executionIndex: 1, title: '拉伸', type: null, completed: false }])
    expect(execution.action_executions).toHaveLength(3)
    expect(removeActionAt(execution, 9)).toBeNull()
  })

  it('lists only student-added items with their execution index', () => {
    const execution = {
      action_executions: [
        { action_name: '深蹲', source: 'plan' },
        { action_name: '早餐', source: 'student_extra', item_type: 'DIET' },
        { action_name: '拉伸', source_action_id: 'a1', item_type: 'HABIT', status: 'completed' },
      ],
    }
    expect(studentExtraTasks(execution)).toEqual([
      { executionIndex: 1, title: '早餐', type: 'DIET', completed: false },
      { executionIndex: 2, title: '拉伸', type: 'HABIT', completed: true },
    ])
    expect(studentExtraTasks(null)).toEqual([])
  })
})
