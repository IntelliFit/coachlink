/**
 * 学员计划 AI 修改器，与小程序 planLibService.previewBatchOperationLocal 一致：
 * 调 /api/plan-lib/batch-operation（SSE 文本），取最后一条 preview_result，只预览不保存。
 */

export function buildBatchOperationBody(params: { trainingDays: unknown[]; instruction: string; subscriptionId?: string; subjectUserId?: string }) {
  return {
    trainingDays: params.trainingDays || [],
    instruction: params.instruction,
    targetActionType: 'coach',
    editEngine: 'plan_script',
    contextOptions: {
      subscriptionId: params.subscriptionId,
      subjectUserId: params.subjectUserId,
      includePlanBody: true,
      includeActionLibrary: true,
      includeStudentProfile: true,
      includeStudentQuestionnaire: true,
      includeExecutionHistory: false,
      includeFeedbacks: true,
      includeStudentActionLib: false,
      includeCoachActionLib: true,
      includePublicActionLib: true,
      includeCoachTemplates: false,
      includeTemplateMatch: false,
    },
  }
}

export function parseBatchOperationMessages(text: string) {
  const messages: any[] = []
  String(text || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const jsonText = trimmed.replace(/^data:\s*/, '')
    if (!jsonText) return
    try {
      messages.push(JSON.parse(jsonText))
    } catch {
      // 半行或心跳，忽略
    }
  })
  return messages
}

/** 从 SSE 消息里取预览；出错时抛出可直接展示的文案。 */
export function extractBatchOperationPreview(messages: any[]) {
  const errorText = [...messages].reverse().find((message) => message?.type === 'error')?.message
  if (errorText) throw new Error(String(errorText))
  const preview = [...messages].reverse().find((message) => message?.type === 'preview_result')
  if (!preview?.updatedTrainingDays) throw new Error('AI 暂未返回可预览的计划修改')
  if (Array.isArray(preview.pendingActions) && preview.pendingActions.length > 0) {
    throw new Error('AI 修改包含动作库外的新动作，请先在 Web 端完成动作确认后再应用')
  }
  const updatedTrainingDays = (preview.updatedTrainingDays as any[]).map((day) => ({
    ...day,
    actionSets: Array.isArray(day?.actionSets) ? day.actionSets : [],
  }))
  if (updatedTrainingDays.length === 0) throw new Error('AI 暂未返回可应用的计划修改')
  const modifications = Array.isArray(preview.modifications) ? preview.modifications : []
  return {
    updatedTrainingDays,
    summary: preview.message || (modifications.length ? `AI 已生成 ${modifications.length} 处修改预览` : 'AI 已生成计划修改预览'),
  }
}
