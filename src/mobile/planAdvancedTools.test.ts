import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatPlanToScript, parsePlanScript } from '../../apps/mobile/src/screens/plan/model/planScript'
import { applyAppendAction, applyDeleteAction, applyReplaceAction, normalizePlanDays } from '../../apps/mobile/src/screens/plan/model/planEditor'
import { buildOneRMIndex, buildStrengthPreview, resolveReferenceOneRM } from '../../apps/mobile/src/screens/plan/model/planStrength'
import type { PlanActionOption } from '../../apps/mobile/src/screens/plan/model/planTypes'

const ROOT = resolve(__dirname, '../..')

/** 只有头注释和导入路径不同，其余必须与小程序逐行一致。 */
function body(path: string) {
  return readFileSync(resolve(ROOT, path), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('// 移植自') && !/from '[^']+'$/.test(line))
    .join('\n')
    .trim()
}

const actions = [
  { id: 'squat', name: '深蹲', type: 'STRENGTH', attrs: ['组数', '次数', '强度', '休息时间'], enableAutoWeightCompute: true },
  { id: 'bench', name: '卧推', type: 'STRENGTH', attrs: ['组数', '次数', '强度', '休息时间'], enableAutoWeightCompute: true },
] as unknown as PlanActionOption[]

describe('plan script port', () => {
  it('stays identical to the mini-program', () => {
    expect(body('apps/mobile/src/screens/plan/model/planScript.ts')).toBe(body('apps/wechat/src/utils/planScript.ts'))
  })

  it('round-trips a plan through the script', () => {
    const parsed = parsePlanScript({ script: 'W1\nD1\n深蹲 5x5 @8rm r180\nD2 off #主动恢复', actions })
    expect(parsed.days).toHaveLength(2)
    const days = normalizePlanDays(parsed.days)
    expect(days[0].type).toBe('training')
    expect(days[1].type).toBe('rest')
    const script = formatPlanToScript({ description: '', days, actions })
    expect(script).toContain('深蹲')
    expect(parsePlanScript({ script, actions }).days).toHaveLength(2)
  })
})

describe('batch operations', () => {
  const days = normalizePlanDays(parsePlanScript({ script: 'W1\nD1\n深蹲 5x5 @8rm r180\nD2\n深蹲 3x5 @8rm r180\n卧推 4x8 @9rm r120', actions }).days)

  it('replaces and deletes an action across the plan', () => {
    const replaced = applyReplaceAction(days, 'squat', actions[1])
    expect(replaced.affectedSets).toBe(2)
    const deleted = applyDeleteAction(days, 'bench')
    expect(deleted.affectedSets).toBe(1)
    expect(deleted.days[1].actionSets).toHaveLength(1)
  })

  it('appends to the chosen weeks and weekdays only', () => {
    const result = applyAppendAction(days, actions[1], 1, 1, [1])
    expect(result.affectedSets).toBe(1)
    expect(result.days[0].actionSets).toHaveLength(2)
    expect(result.days[1].actionSets).toHaveLength(2)
  })
})

describe('auto load preview context', () => {
  it('prefers a value typed for this plan over the stored records', () => {
    const index = buildOneRMIndex([{ actionId: 'squat', actionName: '深蹲', value: 100 } as any])
    const action = actions[0]
    const fromRecord = resolveReferenceOneRM(action, {}, index)
    expect(resolveReferenceOneRM(action, { squat: 140 }, index)).toBe(140)
    expect(resolveReferenceOneRM(undefined, {}, index)).toBeNull()
    expect(fromRecord === null || fromRecord === 100).toBe(true)
  })

  it('computes a load from RM and 1RM, and explains when it cannot', () => {
    const params = { '强度': 8, sets: 3, reps: 8 }
    const auto = buildStrengthPreview(params, { action: actions[0], oneRM: 100, bodyWeight: 70 })
    expect(auto.source).toBe('auto')
    expect(Number(auto.value)).toBeGreaterThan(0)
    expect(buildStrengthPreview(params, { action: actions[0], oneRM: null, bodyWeight: 70 }).source).not.toBe('auto')
  })
})
