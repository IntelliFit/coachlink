import { describe, expect, it } from 'vitest'
import { mergePickerSearchResults } from '../apps/wechat/src/me/action-lib/pickerSearch'

describe('mergePickerSearchResults', () => {
  it('keeps one row per action and prefers the one already in the library', () => {
    const result = mergePickerSearchResults(
      '引体',
      [{ id: 'mine-1', name: '引体向上', canonical_action_id: 'c1' }],
      [
        { id: 'pub-1', name: '引体向上', canonical_action_id: 'c9' },
        { id: 'pub-2', name: '宽握引体（别名）', canonical_action_id: 'c1' },
        { id: 'pub-3', name: '负重引体' }
      ]
    )
    expect(result.map((item) => [item.kind, item.action.id])).toEqual([
      ['owned', 'mine-1'],
      ['public', 'pub-3']
    ])
  })

  it('finds actions of every training type regardless of the selected library', () => {
    const result = mergePickerSearchResults(
      '跑',
      [{ id: 'a', name: '慢跑', type: 'CARDIO' }, { id: 'b', name: '跑姿', type: 'STRENGTH' }],
      []
    )
    expect(result.map((item) => item.action.id).sort()).toEqual(['a', 'b'])
  })

  it('drops diet and habit items', () => {
    const result = mergePickerSearchResults(
      '早',
      [{ id: 'a', name: '早餐', type: 'DIET' }, { id: 'b', name: '早起', type: 'HABIT' }],
      [{ id: 'c', name: '早安深蹲', type: 'STRENGTH' }]
    )
    expect(result.map((item) => item.action.id)).toEqual(['c'])
  })

  it('ranks by how closely the name matches, then keeps the original order', () => {
    const result = mergePickerSearchResults(
      '深蹲',
      [{ id: 'detail', name: '腿部训练' }, { id: 'contains', name: '颈后深蹲' }],
      [{ id: 'prefix', name: '深蹲跳' }, { id: 'exact', name: '深蹲' }, { id: 'contains2', name: '保加利亚深蹲' }]
    )
    expect(result.map((item) => item.action.id)).toEqual(['exact', 'prefix', 'contains', 'contains2', 'detail'])
  })

  it('does not treat missing names or canonical ids as duplicates', () => {
    const result = mergePickerSearchResults('x', [{ id: 'a', name: '' }, { id: 'b', name: null }], [{ id: 'c' }])
    expect(result).toHaveLength(3)
  })
})
