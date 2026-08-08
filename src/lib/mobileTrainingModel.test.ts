import {
  displayLoad,
  normalizeExecution,
  normalizeTrainingItemType,
  parseNumberInput,
} from '../../apps/mobile/src/screens/training/trainingModel'

describe('mobile training execution model', () => {
  it('normalizes strength set fields and keeps the absolute rest duration', () => {
    const result = normalizeExecution({
      id: 'execution-1',
      action_executions: [
        {
          action_id: 'action-1',
          action_name: '深蹲',
          sets: [
            {
              set_number: 1,
              status: 'completed',
              planned_weight: '80',
              planned_reps: '5',
              planned_rest_seconds: 120,
              notes: '最后一次速度偏慢',
              is_pr: true,
              is_auto_pr: false,
              e1rm: 94.5,
              has_video: true,
              video_url: 'https://cdn.example.com/set.mp4',
            },
          ],
        },
      ],
    })

    expect(result.action_executions[0].itemType).toBe('STRENGTH')
    expect(result.action_executions[0].sets[0]).toMatchObject({
      setIndex: 0,
      setNumber: 1,
      plannedWeight: '80',
      plannedReps: '5',
      plannedRestSeconds: 120,
      notes: '最后一次速度偏慢',
      isPr: true,
      isAutoPr: false,
      e1rm: 94.5,
      hasVideo: true,
      videoUrl: 'https://cdn.example.com/set.mp4',
    })
    expect(result.total_sets).toBe(1)
  })

  it('preserves diet and cardio fields used by complete-item', () => {
    const result = normalizeExecution({
      action_executions: [
        {
          action_name: '午餐记录',
          item_type: 'DIET',
          actual_content: '鸡胸肉和米饭',
          completed: true,
          sets: [{ status: 'completed' }],
        },
        {
          action_name: '慢跑',
          type: 'cardio',
          actual_distance: 5000,
          actual_duration: 1800,
          sets: [{ status: 'completed' }],
        },
      ],
    })

    expect(result.action_executions[0]).toMatchObject({
      itemType: 'DIET',
      actualContent: '鸡胸肉和米饭',
      completed: true,
    })
    expect(result.action_executions[1]).toMatchObject({
      itemType: 'CARDIO',
      actualDistance: 5000,
      actualDuration: 1800,
    })
  })

  it('guards unsupported task types and invalid numeric drafts', () => {
    expect(normalizeTrainingItemType('habit')).toBe('HABIT')
    expect(normalizeTrainingItemType('unknown')).toBe('STRENGTH')
    expect(parseNumberInput(' 82.5 ')).toBe(82.5)
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('abc')).toBeNull()
  })

  it('formats missing load values without leaking null text', () => {
    expect(displayLoad(null, 8)).toBe('- x 8')
    expect(displayLoad(60, null)).toBe('60 x -')
  })
})
