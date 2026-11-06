import { describe, expect, it } from 'vitest'
import { inferActionBodyParts, matchesBodyPartFilter, splitActionBodyPartPhrases } from '../packages/core/src/actionBodyParts'

const RULES = [
  { label: '胸部', keywords: ['胸', '卧推', '俯卧撑', '双杠'] },
  { label: '背部', keywords: ['背', '引体', '划船', '下拉', '硬拉'] },
  { label: '手臂', keywords: ['手臂', '二头', '三头', '弯举', '臂屈伸'] },
  { label: '核心', keywords: ['核心', '腹', '卷腹', '平板'] },
  { label: '腿部', keywords: ['腿', '深蹲', '腿举', '弓步'] },
  { label: '臀部', keywords: ['臀', '臀桥', '髋'] },
]

const ARMS = { key: 'arms', keywords: ['手臂', '二头', '三头', '弯举', '臂屈伸'] }
const LEGS = { key: 'legs', keywords: ['腿', '腿部', '股四头', '腘绳', '深蹲'] }
const CORE = { key: 'core', keywords: ['核心', '腹', '腰腹', '平板'] }

describe('action body parts', () => {
  it('counts a leg curl as legs, not arms', () => {
    expect(inferActionBodyParts('俯卧腿弯举', RULES)).toEqual(['腿部'])
    expect(matchesBodyPartFilter('坐姿腿弯举', ARMS)).toBe(false)
    expect(matchesBodyPartFilter('坐姿腿弯举', LEGS)).toBe(true)
  })

  it('counts a hanging leg raise as core, not legs', () => {
    expect(inferActionBodyParts('悬垂举腿', RULES)).toEqual(['核心'])
    expect(matchesBodyPartFilter('悬垂举腿', LEGS)).toBe(false)
    expect(matchesBodyPartFilter('仰卧抬腿', CORE)).toBe(true)
  })

  it('keeps leg extensions and side-lying raises out of arms and core', () => {
    expect(inferActionBodyParts('腿屈伸', RULES)).toEqual(['腿部'])
    expect(inferActionBodyParts('侧卧抬腿', RULES)).toEqual(['臀部'])
  })

  it('leaves ordinary names to the keyword rules', () => {
    expect(inferActionBodyParts('哑铃弯举', RULES)).toEqual(['手臂'])
    expect(inferActionBodyParts('双杠臂屈伸', RULES)).toEqual(['胸部', '手臂'])
    expect(inferActionBodyParts('杠铃深蹲', RULES)).toEqual(['腿部'])
    expect(inferActionBodyParts('腿举', RULES)).toEqual(['腿部'])
    expect(matchesBodyPartFilter('哑铃弯举', ARMS)).toBe(true)
  })

  it('also reads position labels after the phrases are removed', () => {
    const { rest, parts } = splitActionBodyPartPhrases('悬垂举腿 核心 腹部')
    expect(parts).toEqual(['核心'])
    expect(rest).not.toContain('举腿')
    expect(inferActionBodyParts('悬垂举腿 胸部', RULES)).toEqual(['核心', '胸部'])
  })
})
