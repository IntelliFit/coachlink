import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ONBOARDING_FORM,
  buildOnboardingPayloads,
  requiresStudentOnboarding,
  toggleGoal,
  validateOnboardingStep,
} from '../../apps/mobile/src/screens/onboarding/onboardingModel'

const form = { ...DEFAULT_ONBOARDING_FORM, nickname: '小明', gender: 'male', fitnessGoals: ['增肌', '体态矫正'], fitnessLevel: 'novice', weeklyFrequency: 3 }

describe('mobile student onboarding (same rules as the mini-program)', () => {
  it('only sends students without a completed profile to onboarding', () => {
    expect(requiresStudentOnboarding(null, { is_admin: false }, 'student')).toBe(true)
    expect(requiresStudentOnboarding({ onboarding_completed: false }, {}, 'student')).toBe(true)
    expect(requiresStudentOnboarding({ onboarding_completed: true }, {}, 'student')).toBe(false)
    expect(requiresStudentOnboarding(null, {}, 'coach')).toBe(false)
    expect(requiresStudentOnboarding(null, { is_admin: true }, 'student')).toBe(false)
  })

  it('validates each step', () => {
    expect(validateOnboardingStep(1, { ...form, nickname: ' ' })).toBe('请先填写昵称')
    expect(validateOnboardingStep(1, { ...form, gender: '' })).toBe('请选择性别')
    expect(validateOnboardingStep(2, { ...form, height: 260 })).toBe('身高请填写 100–250 cm')
    expect(validateOnboardingStep(3, { ...form, fitnessGoals: [] })).toBe('请选择健身目标')
    expect(validateOnboardingStep(5, { ...form, weeklyFrequency: null })).toBe('请选择每周可训练频率')
    expect(validateOnboardingStep(4, form)).toBeNull()
  })

  it('limits goals to three', () => {
    expect(toggleGoal(['a', 'b', 'c'], 'd')).toEqual({ goals: ['a', 'b', 'c'], error: '健身目标最多选择 3 个' })
    expect(toggleGoal(['a', 'b'], 'a')).toEqual({ goals: ['b'] })
  })

  it('builds the full submission with the primary goal first', () => {
    const { profile, questionnaire } = buildOnboardingPayloads(form, 5, true)
    expect(profile).toMatchObject({ nickname: '小明', gender: 'male', height: 170, weight: 65, fitness_goal: '增肌', fitness_level: 'novice', onboarding_completed: true })
    expect(questionnaire?.answers).toMatchObject({ flow_version: 'registration_unified_v2', fitness_goals: ['增肌', '体态矫正'], interest_tags: ['体态纠正'], weekly_frequency: 3, session_duration: 30 })
  })

  it('saves only what was filled when the user stops early', () => {
    const { profile, questionnaire } = buildOnboardingPayloads({ ...form, fitnessGoals: [], fitnessLevel: '', weeklyFrequency: null }, 1, false)
    expect(profile).not.toHaveProperty('height')
    expect(profile).not.toHaveProperty('fitness_goal')
    expect(profile.onboarding_completed).toBe(true)
    expect(questionnaire).toBeNull()
  })
})
