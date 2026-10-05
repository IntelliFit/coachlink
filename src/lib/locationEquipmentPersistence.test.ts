import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  row: { id: 'equipment-test', name: '公园', contributor_user_id: 'owner', equipment_types: ['parallel_bars'] } as Record<string, any>,
  write: null as Record<string, any> | null,
  error: null as { message: string } | null,
  writes: 0,
}))
vi.mock('@/lib/supabaseClient', () => ({ serviceRoleSupabase: { from: () => {
  let payload: Record<string, any> | null = null
  const query = {
    select: () => query,
    eq: () => query,
    insert: (rows: Record<string, any>[]) => { payload = rows[0]; return query },
    update: (row: Record<string, any>) => { payload = row; return query },
    single: async () => {
      if (payload) {
        state.write = payload; state.writes++
        if (state.error) return { data: null, error: state.error }
        state.row = { ...state.row, ...payload }
      }
      return { data: { ...state.row }, error: null }
    }
  }
  return query
} } }))
vi.mock('../app/api/auth/[...nextauth]/auth', () => ({ getServerSession: async () => ({ user: { id: 'owner', name: '贡献者' } }) }))
vi.mock('../app/api/streetlifting-index/locations/contributorStats', () => ({ rebuildStreetliftingLocationContributorStats: vi.fn() }))
vi.mock('next/server', async () => ({ ...await vi.importActual<typeof import('next/server')>('next/server'), after: vi.fn() }))

import { POST as create } from '../app/api/streetlifting-index/locations/create/route'
import { POST as update } from '../app/api/streetlifting-index/locations/update/route'

const request = (body: Record<string, unknown>) => new Request('http://localhost/equipment', { method: 'POST', body: JSON.stringify({ name: '测试公园', ...body }) })
beforeEach(() => {
  state.row = { id: 'equipment-test', name: '公园', contributor_user_id: 'owner', equipment_types: ['parallel_bars'] }
  state.write = null; state.error = null; state.writes = 0
})

describe('location equipment persistence and legacy clients', () => {
  it('persists several manually confirmed types on creation', async () => {
    const response = await create(request({ equipment_types: ['monkey_bars', 'pullup_bar'] }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(state.write?.equipment_types).toEqual(['pullup_bar', 'monkey_bars'])
    expect(body.data.location.equipment_source).toBe('confirmed')
  })
  it('retains manual corrections on edit despite contradictory text', async () => {
    const response = await update(request({ id: 'equipment-test', description: '有双杠', equipment_types: ['monkey_bars'] }))
    expect((await response.json()).data.location.equipment_types).toEqual(['monkey_bars'])
  })
  it('persists an explicit empty selection without re-inferring', async () => {
    const response = await update(request({ id: 'equipment-test', description: '单杠双杠', equipment_types: [] }))
    expect(state.write?.equipment_types).toEqual([])
    expect((await response.json()).data.location.equipment_types).toEqual([])
  })
  it('does not add the new column for an old creation request', async () => {
    await create(request({ description: '有双杠' }))
    expect(state.write).not.toHaveProperty('equipment_types')
  })
  it('does not erase existing tags when an old client edits other fields', async () => {
    const response = await update(request({ id: 'equipment-test', description: '北门右转' }))
    expect(state.write).not.toHaveProperty('equipment_types')
    expect((await response.json()).data.location.equipment_types).toEqual(['parallel_bars'])
  })
  it('rejects unsupported types before writing', async () => {
    const response = await create(request({ equipment_types: ['unsupported'] }))
    expect(response.status).toBe(400)
    expect(state.writes).toBe(0)
  })
  it('does not silently report success when the equipment migration is missing', async () => {
    state.error = { message: 'column equipment_types does not exist' }
    const response = await create(request({ equipment_types: ['parallel_bars'] }))
    expect(response.status).toBe(500)
    expect((await response.json()).success).toBe(false)
  })
})
