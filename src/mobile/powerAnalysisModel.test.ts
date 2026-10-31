import { describe, expect, it } from 'vitest'
import {
  buildPowerComparisonRows,
  describePowerMeasurement,
  formatComparisonDelta,
  getComparisonBlocker,
  getPowerComparisonVerdict,
  isComparisonImproved,
  isDailyLimitMessage,
  powerAudioText,
  powerRepText,
  powerSummaryTiles,
  type PowerAnalysisMetrics,
} from '../../apps/mobile/src/screens/toolbox/powerAnalysisModel'

function metrics(overrides: Partial<PowerAnalysisMetrics> = {}, summary: Partial<PowerAnalysisMetrics['summary']> = {}): PowerAnalysisMetrics {
  return {
    mode: 'pullup',
    repCount: 5,
    reps: [],
    ...overrides,
    summary: { avgPowerW: 300, bestPowerW: 400, bestHorsepowerHp: 0.54, bestVelocityMps: 1.2, avgAscentTimeS: 1, avgDisplacementM: 0.5, ...summary },
  }
}

describe('power analysis result tiles (same as the mini-program)', () => {
  it('shows power for bodyweight, mean velocity for barbell, range for custom', () => {
    expect(powerSummaryTiles(metrics()).map((tile) => tile.label)).toEqual(['有效次数', '最高功率', '最高马力', '最快速度'])
    const barbell = powerSummaryTiles(metrics({ mode: 'back_squat' }, { bestMeanVelocityMps: 0.61, velocityLossPct: 12.4 }))
    expect(barbell.map((tile) => tile.value)).toEqual(['5', '0.61 m/s', '12%', '400 W'])
    expect(powerSummaryTiles(metrics({ mode: 'back_squat' })).find((tile) => tile.label === '组内速度下降')?.value).toBe('-')
    const custom = powerSummaryTiles(metrics({
      mode: 'custom',
      custom: { actionNameZh: '弯举', primaryPartZh: '手腕', phaseLabelsZh: ['上举', '下放'], mainJointZh: '肘' },
      reps: [{ repIndex: 1, displacementM: 0.4, ascentTimeS: 1, avgPowerW: 0, horsepowerHp: 0, maxVelocityMps: 0, phase1TimeS: 1.2, phase2TimeS: 1.6 }],
    }))
    expect(custom.map((tile) => `${tile.label}:${tile.value}`)).toEqual(['有效次数:5', '平均幅度:40 cm', '平均上举:1.2 s', '平均下放:1.6 s'])
  })

  it('describes each rep by movement type', () => {
    const rep = { repIndex: 1, displacementM: 0.5, ascentTimeS: 0.9, avgPowerW: 350, horsepowerHp: 0.47, maxVelocityMps: 1.1, meanVelocityMps: 0.6, pauseS: 0.3, phase1TimeS: 1, phase2TimeS: 2, holdTimeS: 0.5, jointMinDeg: 40, jointMaxDeg: 150 }
    expect(powerRepText(metrics(), rep).main).toBe('350 W · 0.47 hp')
    expect(powerRepText(metrics({ mode: 'deadlift' }), rep).main).toBe('平均速度 0.60 m/s · 350 W')
    expect(powerRepText(metrics(), rep).detail).toContain('停顿 0.30 s')
    const custom = metrics({ mode: 'custom', custom: { actionNameZh: '弯举', primaryPartZh: '手腕', phaseLabelsZh: ['上举', '下放'], mainJointZh: '肘' } })
    expect(powerRepText(custom, rep)).toEqual({ main: '幅度 50 cm · 肘 40°～150°', detail: '上举 1.00 s · 下放 2.00 s · 停留 0.50 s' })
  })
})

describe('power analysis before / after comparison', () => {
  it('only judges comparable tests', () => {
    expect(getComparisonBlocker({ mode: 'pullup', externalLoadKg: 0 }, { mode: 'dip', externalLoadKg: 0 })).toContain('动作类型不同')
    expect(getComparisonBlocker({ mode: 'custom', externalLoadKg: 0 }, { mode: 'custom', externalLoadKg: 0 })).toContain('试验功能')
    expect(getComparisonBlocker({ mode: 'bench_press', externalLoadKg: 60 }, { mode: 'bench_press', externalLoadKg: 80 })).toContain('杠铃重量不同')
    expect(getComparisonBlocker({ mode: 'bench_press', externalLoadKg: 60 }, { mode: 'bench_press', externalLoadKg: 60 })).toBe('')
    expect(getComparisonBlocker(null, { mode: 'pullup', externalLoadKg: 0 })).toContain('动作类型不同')
  })

  it('scores improvements, treating lower ascent time as better', () => {
    const rows = buildPowerComparisonRows(metrics(), metrics({}, { bestPowerW: 500, avgPowerW: 380, bestVelocityMps: 1.5, avgAscentTimeS: 0.8 }))
    expect(rows.map((row) => row.key)).toEqual(['bestPowerW', 'avgPowerW', 'bestVelocityMps', 'avgAscentTimeS'])
    expect(rows.every(isComparisonImproved)).toBe(true)
    expect(getPowerComparisonVerdict(rows, '')).toBe('后测综合表现更好')
    expect(formatComparisonDelta(rows[0])).toBe('+100 W')
    expect(formatComparisonDelta(rows[3])).toBe('-0.20 s')
    expect(getPowerComparisonVerdict(buildPowerComparisonRows(metrics(), metrics()), '')).toBe('两次表现接近，各有优势')
    expect(getPowerComparisonVerdict(rows, '杠铃重量不同')).toBe('杠铃重量不同')
  })

  it('adds mean velocity for barbell lifts and uses range for custom', () => {
    const barbell = metrics({ mode: 'bench_press' }, { bestMeanVelocityMps: 0.5 })
    expect(buildPowerComparisonRows(barbell, barbell)[0].key).toBe('bestMeanVelocityMps')
    expect(buildPowerComparisonRows(metrics({ mode: 'custom' }), metrics({ mode: 'custom' })).map((row) => row.key)).toEqual(['repCount', 'avgDisplacementM'])
  })
})

describe('power analysis notes', () => {
  it('explains how the movement was measured', () => {
    expect(describePowerMeasurement(undefined)).toBe('')
    expect(describePowerMeasurement({ target: 'barbell_plate', anchorLabelZh: '', scaleSource: 'plate_diameter', confidence: 'high', plateDiameterCm: 45, trackingCoverage: 0.92, warningsZh: [] })).toBe('测量对象：杠铃片中心（按直径 45 cm 换算，追踪覆盖 92%）')
    expect(describePowerMeasurement({ target: 'barbell_body_proxy', anchorLabelZh: '肩部', scaleSource: 'body_height', confidence: 'low', warningsZh: [] })).toContain('误差较大')
    expect(describePowerMeasurement({ target: 'body_anchor', anchorLabelZh: '肩部', scaleSource: 'unknown', confidence: 'medium', warningsZh: [] })).toBe('测量对象：肩部位置（按身高换算）')
  })

  it('reports audio state and recognises the daily limit', () => {
    expect(powerAudioText(undefined)).toBe('')
    expect(powerAudioText({ inputHasAudio: false })).toBe('上传视频未检测到音轨')
    expect(powerAudioText({ inputHasAudio: true, audioPreserved: true })).toBe('已保留原视频背景音效')
    expect(powerAudioText({ inputHasAudio: true, audioPreserved: false })).toBe('结果音轨异常，请重新分析')
    expect(isDailyLimitMessage('今天已经分析 5 次')).toBe(true)
    expect(isDailyLimitMessage('上传失败')).toBe(false)
  })
})
