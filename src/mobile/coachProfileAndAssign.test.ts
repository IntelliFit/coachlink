import { describe, expect, it } from 'vitest'
import {
  buildCoachProfilePayload,
  coachProfileFormFromCoach,
  validateCoachProfileForm,
} from '../../apps/mobile/src/screens/coach/coachProfileForm'
import { assignPlanSuccessMessage, buildAssignPlanRequest } from '../../apps/mobile/src/screens/coach/assignPlanRequest'

describe('coach public profile form (same payload as the mini-program)', () => {
  const coach = {
    id: 'c1',
    name: '王教练',
    title: '力量举教练',
    bio: '十年训练经验',
    years_experience: 10,
    specialties: ['增肌', ''],
    profile: {
      teachingPhilosophy: '先动作后重量',
      achievements: ['全国冠军'],
      credentials: [{ name: 'NSCA-CPT', url: 'https://x.com/c' }, { name: ' ' }],
      socialLinks: { douyin: 'https://douyin.com/u', unknown: 'x' },
      contactEmail: 'a@b.com',
    },
  }

  it('reads an existing coach into the form', () => {
    const form = coachProfileFormFromCoach(coach)
    expect(form).toMatchObject({ name: '王教练', yearsExperience: '10', specialties: ['增肌'], achievements: ['全国冠军'], caseStudies: [] })
    expect(form.credentials).toEqual([{ name: 'NSCA-CPT', url: 'https://x.com/c' }])
    expect(form.socialLinks).toEqual([{ platform: 'douyin', url: 'https://douyin.com/u' }])
  })

  it('stores empty fields as null', () => {
    const form = { ...coachProfileFormFromCoach(coach), title: ' ', caseStudies: [], socialLinks: [], yearsExperience: '' }
    const payload = buildCoachProfilePayload('c1', form)
    expect(payload).toMatchObject({ id: 'c1', name: '王教练', title: null, yearsExperience: null, specialties: ['增肌'] })
    expect(payload.profile).toMatchObject({ caseStudies: null, socialLinks: null, contactPhone: null, contactEmail: 'a@b.com' })
  })

  it('validates name, years and email', () => {
    const form = coachProfileFormFromCoach(coach)
    expect(validateCoachProfileForm(form)).toBeNull()
    expect(validateCoachProfileForm({ ...form, name: ' ' })).toBe('请填写教练名称')
    expect(validateCoachProfileForm({ ...form, yearsExperience: '99' })).toBe('从业年限请填写 0–60 的整数')
    expect(validateCoachProfileForm({ ...form, contactEmail: 'bad' })).toBe('邮箱格式不正确')
  })
})

describe('assign plan request (same rules as the mini-program)', () => {
  const template = { id: 't1', name: '新模板', description: null }
  const templateDays = [
    { dayIndex: 1, type: 'training', actionSets: [{ action_id: 'new-a' }] },
    { dayIndex: 2, type: 'training', actionSets: [{ action_id: 'new-b' }] },
    { dayIndex: 3, type: 'training', actionSets: [{ action_id: 'new-c' }] },
  ]
  const currentPlan = {
    id: 'p1',
    start_date: '2026-10-01',
    training_days: [
      { dayIndex: 1, type: 'training', actionSets: [{ action_id: 'old-a' }] },
      { dayIndex: 2, type: 'training', actionSets: [{ action_id: 'old-b' }] },
      { dayIndex: 3, type: 'training', actionSets: [{ action_id: 'old-c' }] },
    ],
  }

  it('updates in place when the current plan has no workouts yet', () => {
    const request = buildAssignPlanRequest({ mode: 'overwrite', subscriptionId: 's1', template, templateDays, startDayIndex: 1, currentPlan, executionsByDayIndex: {} })
    expect(request.endpoint).toBe('/api/plan-lib/update-instance')
    expect(request.body).toMatchObject({ id: 'p1', templateId: 't1', startExecutionDay: 1, trainingDays: templateDays })
  })

  it('keeps trained days and the calendar anchor when overwriting a plan in progress', () => {
    const request = buildAssignPlanRequest({ mode: 'overwrite', subscriptionId: 's1', template, templateDays, startDayIndex: 1, currentPlan,
      executionsByDayIndex: { 1: { day_index: 1, status: 'completed' } } })
    expect(request.endpoint).toBe('/api/plan-lib/create-instance')
    expect(request.body).toMatchObject({ revisionOfInstanceId: 'p1', startDate: '2026-10-01', startWeek: 1, startDay: 2 })
    const days = (request.body as any).trainingDays
    expect(days[0].actionSets[0].action_id).toBe('old-a')
    expect(days[1].actionSets[0].action_id).toBe('new-b')
    expect(request.keepsTrainedDays).toBe(true)
    expect(assignPlanSuccessMessage(request)).toBe('已保留第1天，模板从第2天起生效')
  })

  it('creates a new phase anchored to today minus the start offset', () => {
    const request = buildAssignPlanRequest({ mode: 'new_instance', subscriptionId: 's1', template, templateDays, startDayIndex: 3, currentPlan,
      executionsByDayIndex: { 1: { day_index: 1, status: 'completed' } }, today: new Date('2026-10-29T10:00:00+08:00') })
    expect(request.endpoint).toBe('/api/plan-lib/create-instance')
    expect(request.body).toMatchObject({ subscriptionId: 's1', revisionOfInstanceId: undefined, startDate: '2026-10-27', startWeek: 1, startDay: 3, trainingDays: templateDays })
    expect(assignPlanSuccessMessage(request)).toBe('新计划已同步到学员训练首页。')
  })

  it('always creates a new instance when there is no current plan', () => {
    const request = buildAssignPlanRequest({ mode: 'overwrite', subscriptionId: 's1', template, templateDays, startDayIndex: 1, currentPlan: null })
    expect(request.endpoint).toBe('/api/plan-lib/create-instance')
    expect((request.body as any).revisionOfInstanceId).toBeUndefined()
  })
})

describe('AI quick-generate config (same as the mini-program)', () => {
  it('clamps the start position and explains a mid-plan start', async () => {
    const { aiGeneratedPlanName, aiStartHint, bulkAiResultMessage, parseAiGenerationConfig } = await import('../../apps/mobile/src/screens/coach/aiGenerateConfig')
    expect(parseAiGenerationConfig('0', '9', true)).toEqual({ startWeek: 1, startDay: 7, keepOriginalIndex: true, useLLM: true })
    expect(aiStartHint(parseAiGenerationConfig('1', '1', false))).toBe('')
    expect(aiStartHint(parseAiGenerationConfig('2', '3', false))).toBe('学员将从第 2 周第 3 天开始执行，前 9 天视为已完成。')
    expect(aiGeneratedPlanName('AI 生成计划', '小明')).toBe('小明的计划')
    expect(aiGeneratedPlanName('增肌 8 周', '小明')).toBe('增肌 8 周')
    expect(bulkAiResultMessage({ successCount: 3, failedCount: 1 }, true)).toBe('LLM成功 3 个，失败 1 个')
    expect(bulkAiResultMessage({ successCount: 2 }, false)).toBe('规则生成 2 个')
  })
})

describe('AI plan modifier stream parsing (same as the mini-program)', () => {
  it('takes the last preview and surfaces errors', async () => {
    const { buildBatchOperationBody, extractBatchOperationPreview, parseBatchOperationMessages } = await import('../../apps/mobile/src/screens/coach/aiPlanModifier')
    expect(buildBatchOperationBody({ trainingDays: [], instruction: '减一组', subscriptionId: 's1' })).toMatchObject({ targetActionType: 'coach', editEngine: 'plan_script', contextOptions: { subscriptionId: 's1', includeFeedbacks: true } })
    const text = [
      'data: {"type":"progress"}',
      'data: {not json',
      'data: {"type":"preview_result","updatedTrainingDays":[{"dayIndex":1}],"modifications":[1,2]}',
    ].join('\n')
    const preview = extractBatchOperationPreview(parseBatchOperationMessages(text))
    expect(preview.updatedTrainingDays).toEqual([{ dayIndex: 1, actionSets: [] }])
    expect(preview.summary).toBe('AI 已生成 2 处修改预览')
    expect(() => extractBatchOperationPreview(parseBatchOperationMessages('data: {"type":"error","message":"额度不足"}'))).toThrow('额度不足')
    expect(() => extractBatchOperationPreview([{ type: 'preview_result', updatedTrainingDays: [{}], pendingActions: [{}] }])).toThrow('动作库外的新动作')
    expect(() => extractBatchOperationPreview([])).toThrow('AI 暂未返回可预览的计划修改')
  })
})

describe('coach questionnaire answers (same rules as the mini-program, plus two fixes)', () => {
  it('shows every question type as readable text', async () => {
    const { questionnaireAnswerText, questionnaireQuestionText } = await import('../../apps/mobile/src/screens/coach/questionnaireAnswers')
    expect(questionnaireAnswerText({ type: 'tags', userSelections: ['增肌', '减脂'] })).toBe('增肌、减脂')
    expect(questionnaireAnswerText({ type: 'times', userSelection: 3 })).toBe('3 次/周')
    expect(questionnaireAnswerText({ type: 'option', options: ['新手', '进阶'], userSelection: 1 })).toBe('进阶')
    expect(questionnaireAnswerText({ type: 'option', options: ['新手', '进阶'], userSelection: '' })).toBe('未填写')
    expect(questionnaireAnswerText({ type: 'rm', userInputs: { 深蹲: 100, 卧推: 0 } })).toBe('深蹲: 100kg')
    expect(questionnaireQuestionText({ type: 'rm' })).toBe('基础 1RM 数据')
  })

  it('keeps answers to questions the coach has since removed', async () => {
    const { mergeQuestionnaireAnswers } = await import('../../apps/mobile/src/screens/coach/questionnaireAnswers')
    const merged = mergeQuestionnaireAnswers(
      [{ id: 'q1', type: 'text', question: '目标' }, { type: 'tags', options: ['增肌'] }],
      [{ id: 'q1', type: 'text', userSelection: '增肌' }, { type: 'tags', userSelections: ['增肌'] }, { id: 'old', type: 'text', question: '旧题', userSelection: '保留' }],
    )
    expect(merged.map((item: any) => item.userSelection ?? item.userSelections)).toEqual(['增肌', ['增肌'], '保留'])
  })

  it('edits 1RM by action name, not by id', async () => {
    const { finalizeQuestionnaireDraft, mergeQuestionnaireAnswers, rmInputKeys } = await import('../../apps/mobile/src/screens/coach/questionnaireAnswers')
    const [item] = mergeQuestionnaireAnswers(
      [{ type: 'rm', actionIds: ['uuid-1', 'uuid-2'], userInputs: { 深蹲: '', 卧推: '' } }],
      [{ type: 'rm', userInputs: { 深蹲: 120 } }],
    )
    expect(rmInputKeys(item)).toEqual(['深蹲', '卧推'])
    expect(item.userInputs).toEqual({ 深蹲: 120, 卧推: '' })
    expect(rmInputKeys({ type: 'rm', actionIds: ['uuid-1'] })).toEqual(['uuid-1'])
    expect(finalizeQuestionnaireDraft([{ type: 'rm', userInputs: { 深蹲: '100.5', 卧推: '' } }])[0].userInputs).toEqual({ 深蹲: 100.5, 卧推: 0 })
  })

  it('does not treat an empty answer as the first option', async () => {
    const { isOptionSelected, toggleTagSelection } = await import('../../apps/mobile/src/screens/coach/questionnaireAnswers')
    expect(isOptionSelected({ type: 'option', userSelection: '' }, 'A', 0)).toBe(false)
    expect(isOptionSelected({ type: 'option', userSelection: 0 }, 'A', 0)).toBe(true)
    expect(isOptionSelected({ type: 'option', userSelection: 'B' }, 'B', 1)).toBe(true)
    expect(toggleTagSelection({ userSelections: ['a'] }, 'a').userSelections).toEqual([])
    expect(toggleTagSelection({ userSelections: ['a'] }, 'b').userSelections).toEqual(['a', 'b'])
  })

  it('only offers refunds for platform Alipay orders', async () => {
    const { refundableOrderId } = await import('../../apps/mobile/src/screens/coach/questionnaireAnswers')
    expect(refundableOrderId({ payment_method: 'platform_alipay', last_payment_order_id: 'o1', order_id: 'o2' })).toBe('o1')
    expect(refundableOrderId({ payment_method: 'platform_alipay', order_id: 'o2' })).toBe('o2')
    expect(refundableOrderId({ payment_method: 'platform_alipay' })).toBeNull()
    expect(refundableOrderId({ payment_method: 'offline', order_id: 'o2' })).toBeNull()
  })
})
