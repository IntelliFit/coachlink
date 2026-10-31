import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildMuscleScores, highlightBodySvg } from '../../packages/core/src/publicTrainingSummary'
import maleBackSvg from '../../apps/mobile/src/assets/body-map/maleBackSvg'
import maleFrontSvg from '../../apps/mobile/src/assets/body-map/maleFrontSvg'
import {
  buildTrainingShareText,
  formatShareDateTime,
  mergeTrainingShare,
  publicTrainingUrl,
  stripSvgProlog,
  trainingShareTitle,
  volumeInTons,
} from '../../apps/mobile/src/screens/training/trainingShareModel'

const ROOT = resolve(__dirname, '../..')
const HIGHLIGHT = '#CF6D4E'

describe('training share body map', () => {
  it('keeps the same SVG assets as the mini-program', () => {
    for (const name of ['maleFrontSvg.ts', 'maleBackSvg.ts']) {
      expect(readFileSync(resolve(ROOT, 'apps/mobile/src/assets/body-map', name), 'utf8'))
        .toBe(readFileSync(resolve(ROOT, 'apps/wechat/src/assets/body-map', name), 'utf8'))
    }
  })

  it('highlights nothing when no muscle was trained', () => {
    expect(highlightBodySvg(maleFrontSvg, [])).not.toContain(HIGHLIGHT)
    expect(highlightBodySvg(maleBackSvg, [])).not.toContain(HIGHLIGHT)
  })

  it('highlights every trained part on the matching side, including labels the SVG names differently', () => {
    for (const label of ['胸部', '肩部', '手臂', '核心', '腿部']) {
      expect(highlightBodySvg(maleFrontSvg, [label]), label).toContain(HIGHLIGHT)
    }
    for (const label of ['背部', '臀部', '手臂', '腿部']) {
      expect(highlightBodySvg(maleBackSvg, [label]), label).toContain(HIGHLIGHT)
    }
  })

  it('strips the XML prolog and comments for react-native-svg', () => {
    const xml = stripSvgProlog(maleFrontSvg)
    expect(xml.startsWith('<svg')).toBe(true)
    expect(xml).not.toContain('<!--')
  })
})

describe('training share muscle scores', () => {
  it('sums sets and tonnage per inferred muscle, highest first', () => {
    expect(buildMuscleScores([
      { actionName: '杠铃深蹲', setsCount: 5, volume: 3000 },
      { actionName: '卧推', setsCount: 3, volume: 1000 },
      { actionName: '未知动作', setsCount: 9, volume: 0 },
    ])).toEqual([{ label: '腿部', score: 8 }, { label: '胸部', score: 4 }])
  })

  it('does not count an action with no completed sets', () => {
    expect(buildMuscleScores([{ actionName: '杠铃深蹲', setsCount: 0, volume: 0 }])).toEqual([])
  })
})

describe('training share data', () => {
  const shareInfo = {
    shareToken: 'tok en',
    planName: '计划 A',
    completedAt: '2026-10-31T06:33:00.000Z',
    totalVolume: 1000,
    totalSets: 3,
    durationMinutes: 20,
    prRecords: [{ exerciseName: '卧推', weight: 100, reps: 1 }],
    user: { nickname: '小明', avatarUrl: '' },
  }

  it('uses the public summary when available and keeps PR and token from share-info', () => {
    const merged = mergeTrainingShare(shareInfo, {
      planName: '计划 A',
      completedAt: shareInfo.completedAt,
      totalVolume: 12340,
      totalSets: 18,
      durationMinutes: 45,
      actionExecutions: [{ actionName: '卧推', setsCount: 3, volume: 900 }],
      user: { nickname: '小明', avatarUrl: 'a.png' },
    })
    expect(merged).toMatchObject({ totalVolume: 12340, totalSets: 18, prCount: 1, shareToken: 'tok en', avatarUrl: 'a.png' })
    expect(merged.actions).toHaveLength(1)
  })

  it('still shows the summary when the public endpoint failed', () => {
    const merged = mergeTrainingShare(shareInfo, null)
    expect(merged).toMatchObject({ totalVolume: 1000, totalSets: 3, nickname: '小明', actions: [] })
  })

  it('builds share text with a link to the web page', () => {
    const merged = mergeTrainingShare(shareInfo, null)
    expect(buildTrainingShareText(merged, 'https://coachlink.fit/')).toBe([
      '小明 完成了「计划 A」训练',
      '2026/10/31 14:33',
      '总容量 1 吨 · 3 组 · 20 分钟 · PR 1 项',
      'https://coachlink.fit/public/training/tok%20en',
    ].join('\n'))
    expect(publicTrainingUrl('https://coachlink.fit', '')).toBe('')
  })

  it('formats helpers', () => {
    expect(volumeInTons(12340)).toBe(12.3)
    expect(formatShareDateTime('')).toBe('')
    expect(formatShareDateTime('bad')).toBe('bad')
    expect(trainingShareTitle('', '')).toBe('我在 CoachLink 完成了一次训练打卡')
    expect(trainingShareTitle('小明', '')).toBe('小明 完成了一次训练打卡')
    expect(trainingShareTitle('', '计划 A')).toBe('我在 CoachLink 完成了「计划 A」训练')
  })
})
