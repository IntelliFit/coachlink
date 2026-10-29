import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as appEditor from '../../apps/mobile/src/screens/plan/model/planEditor'
import * as appStrength from '../../apps/mobile/src/screens/plan/model/planStrength'
import {
  addActionSet,
  copyDayTo,
  finalizeDays,
  findUnpickedStrength,
  moveActionSet,
  removeActionSet,
  replaceActionSet,
  setDayType,
} from '../../apps/mobile/src/screens/plan/model/planDayOps'
import * as weappEditor from '../../apps/wechat/src/utils/planEditor'
import * as weappStrength from '../../apps/wechat/src/utils/planStrength'

const ROOT = resolve(__dirname, '../..')

/** 去掉移植时改过的头注释和导入行，剩下的代码必须与小程序原文件逐行一致。 */
function body(path: string) {
  return readFileSync(resolve(ROOT, path), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('import ') && !line.startsWith('// 移植自'))
    .join('\n')
    .trim()
}

describe('mobile plan editor port stays identical to the mini-program', () => {
  it.each([
    ['apps/mobile/src/screens/plan/model/planEditor.ts', 'apps/wechat/src/utils/planEditor.ts'],
    ['apps/mobile/src/screens/plan/model/planStrength.ts', 'apps/wechat/src/utils/planStrength.ts'],
    ['apps/mobile/src/screens/plan/model/rmCalculator.ts', 'apps/wechat/src/utils/rmCalculator.ts'],
    ['apps/mobile/src/screens/me/sportsCollections.ts', 'apps/wechat/src/utils/sportsCollections.ts'],
  ])('%s matches %s', (appPath, weappPath) => {
    expect(body(appPath)).toBe(body(weappPath))
  })

  it('produces the same strength params as the mini-program', () => {
    const params = { sets: 3, reps: '8', load: 60 }
    for (const control of [{ mode: 'rm', value: '8' }, { mode: 'percentage', value: '75' }, { mode: 'fixed', value: '80' }, { mode: 'rm', value: '' }] as const) {
      expect(appStrength.applyStrengthControlValue(params, control)).toEqual(weappStrength.applyStrengthControlValue(params, control))
    }
    expect(appEditor.createDefaultPlanDays(2, 'coach')).toEqual(weappEditor.createDefaultPlanDays(2, 'coach'))
  })
})

describe('mobile plan day operations', () => {
  const days = appEditor.createDefaultPlanDays(1, 'student')

  it('adds items as training days and keeps counts in sync', () => {
    const rest = days.find((day) => day.type === 'rest')!
    const next = addActionSet(days, rest.dayIndex, 'CARDIO')
    const changed = next.find((day) => day.dayIndex === rest.dayIndex)!
    expect(changed.type).toBe('training')
    expect(changed.actionSets).toHaveLength(1)
    expect(changed.actionSetsCount).toBe(1)
    expect(days.find((day) => day.dayIndex === rest.dayIndex)!.actionSets).toHaveLength(0)
  })

  it('moves, replaces and removes items without touching other days', () => {
    let next = addActionSet(days, 1, 'STRENGTH')
    next = addActionSet(next, 1, 'CARDIO')
    next = moveActionSet(next, 1, 1, -1)
    expect(next[0].actionSets.map((set) => set.itemType)).toEqual(['CARDIO', 'STRENGTH'])
    expect(moveActionSet(next, 1, 0, -1)).toEqual(next)
    next = replaceActionSet(next, 1, 1, { ...next[0].actionSets[1], actionId: 'a1', actionName: '深蹲' })
    expect(next[0].actionSets[1].actionName).toBe('深蹲')
    next = removeActionSet(next, 1, 0)
    expect(next[0].actionSets.map((set) => set.actionName)).toEqual(['深蹲'])
    expect(next[1]).toBe(days[1])
  })

  it('copies a day as an independent clone', () => {
    let next = addActionSet(days, 1, 'STRENGTH')
    next = copyDayTo(next, 1, 3)
    expect(next[2].actionSets).toEqual(next[0].actionSets)
    expect(next[2].actionSets).not.toBe(next[0].actionSets)
    expect(copyDayTo(next, 1, 1)).toBe(next)
  })

  it('finds strength items without an action and finalizes order', () => {
    const withEmpty = addActionSet(days, 2, 'STRENGTH')
    expect(findUnpickedStrength(withEmpty)).toEqual({ dayIndex: 2, setIndex: 0 })
    expect(findUnpickedStrength(setDayType(withEmpty, 2, 'rest'))).toBeNull()
    const shuffled = [withEmpty[3], withEmpty[0], withEmpty[1]]
    expect(finalizeDays(shuffled).map((day) => day.dayIndex)).toEqual([1, 2, 4])
  })
})
