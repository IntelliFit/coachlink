import { describe, expect, it } from 'vitest'
import {
  executionActionKey,
  findNextOpenActionIndex,
  isIdentityActionOrder,
  isValidActionOrder,
  moveInActionOrder,
  remapActionIndex,
  reorderExecutionActions
} from '../packages/core/src/executionActionOrder'
import { remapImpromptuSetVideos } from '../src/app/api/impromptu/_helpers/reorderSetVideos'

describe('isValidActionOrder', () => {
  it('accepts only a full permutation', () => {
    expect(isValidActionOrder([2, 0, 1], 3)).toBe(true)
    expect(isValidActionOrder([0, 0, 1], 3)).toBe(false)
    expect(isValidActionOrder([0, 1], 3)).toBe(false)
    expect(isValidActionOrder([0, 1, 3], 3)).toBe(false)
    expect(isValidActionOrder([0, 1.5, 2], 3)).toBe(false)
    expect(isValidActionOrder('012', 3)).toBe(false)
  })
})

describe('reorderExecutionActions', () => {
  const actions = [
    { action_id: 'a', action_order: 1, source_action_index: 0 },
    { action_id: 'b', action_order: 2 },
    { action_id: 'x', action_order: 3, source: 'student_extra' }
  ]

  it('renumbers without touching the input', () => {
    const result = reorderExecutionActions(actions, [2, 0, 1])
    expect(result.map((item) => item.action_id)).toEqual(['x', 'a', 'b'])
    expect(result.map((item: any) => item.action_order)).toEqual([1, 2, 3])
    expect(result.map((item: any) => item.action_index)).toEqual([0, 1, 2])
    expect(actions[0].action_order).toBe(1)
    expect(result[2].source_action_index).toBeUndefined()
  })

  it('keeps plan actions tied to their plan index and extras out of the plan range', () => {
    const result = reorderExecutionActions(actions, [2, 1, 0], { keepPlanIndex: true })
    expect(result.map((item) => item.source_action_index)).toEqual([5, 1, 0])
  })
})

describe('order helpers', () => {
  it('moves one step and ignores moves past either end', () => {
    expect(moveInActionOrder([0, 1, 2], 1, -1)).toEqual([1, 0, 2])
    expect(moveInActionOrder([0, 1, 2], 1, 1)).toEqual([0, 2, 1])
    expect(moveInActionOrder([0, 1, 2], 0, -1)).toEqual([0, 1, 2])
    expect(moveInActionOrder([0, 1, 2], 2, 1)).toEqual([0, 1, 2])
  })

  it('maps an old index to its new position', () => {
    expect(remapActionIndex(0, [2, 0, 1])).toBe(1)
    expect(remapActionIndex(2, [2, 0, 1])).toBe(0)
    expect(isIdentityActionOrder([0, 1, 2])).toBe(true)
    expect(isIdentityActionOrder([1, 0, 2])).toBe(false)
  })

  it('builds a stable key from the action id or name', () => {
    expect(executionActionKey({ action_id: 'a', action_name: 'x' })).toBe('a')
    expect(executionActionKey({ source_action_id: 'b' })).toBe('b')
    expect(executionActionKey({ action_name: '深蹲' })).toBe('深蹲')
  })
})

describe('findNextOpenActionIndex', () => {
  const open = { completed_sets: 0, total_sets: 2 }
  const done = { completed_sets: 2, total_sets: 2 }

  it('prefers later actions and wraps back to one moved earlier', () => {
    expect(findNextOpenActionIndex([open, done, open], 1)).toBe(2)
    expect(findNextOpenActionIndex([open, done, done], 2)).toBe(0)
    expect(findNextOpenActionIndex([done, done], 0)).toBe(-1)
  })
})

function fakeVideoClient(rows: Array<{ id: string; action_index: number; set_number: number }>, failOnCall = -1) {
  let calls = 0
  return {
    rows,
    from: () => ({
      select: () => ({ eq: async () => ({ data: rows.map((row) => ({ ...row })), error: null }) }),
      update: (patch: { action_index: number }) => ({
        eq: async (_column: string, id: string) => {
          calls += 1
          if (calls === failOnCall) return { error: { message: 'boom' } }
          const row = rows.find((item) => item.id === id)!
          const clash = rows.some((item) => item !== row && item.action_index === patch.action_index && item.set_number === row.set_number)
          if (clash) return { error: { message: 'duplicate key' } }
          row.action_index = patch.action_index
          return { error: null }
        }
      })
    })
  }
}

describe('remapImpromptuSetVideos', () => {
  const twoVideos = () => [
    { id: 'v0', action_index: 0, set_number: 1 },
    { id: 'v1', action_index: 1, set_number: 1 }
  ]

  it('swaps rows without tripping the unique constraint', async () => {
    const client = fakeVideoClient(twoVideos())
    expect(await remapImpromptuSetVideos(client, 'e', [1, 0])).not.toBeNull()
    expect(client.rows.map((row) => row.action_index)).toEqual([1, 0])
  })

  it('restores the original indexes', async () => {
    const client = fakeVideoClient(twoVideos())
    const remapped = await remapImpromptuSetVideos(client, 'e', [1, 0])
    expect(await remapped!.restore()).toBe(true)
    expect(client.rows.map((row) => row.action_index)).toEqual([0, 1])
  })

  it('returns null and rolls back when a write fails midway', async () => {
    const client = fakeVideoClient(twoVideos(), 2)
    expect(await remapImpromptuSetVideos(client, 'e', [1, 0])).toBeNull()
    expect(client.rows.map((row) => row.action_index)).toEqual([0, 1])
  })
})
