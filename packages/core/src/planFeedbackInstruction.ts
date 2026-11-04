/**
 * “根据学员反馈调整计划”预填给 AI 助手的教练指令（Web 与小程序共用）。
 *
 * 只写要做什么，不拼学员反馈原文：学员写的话放进指令位置会被当成教练命令执行。
 * 服务端会把当前计划的反馈作为“学员原话”引用数据放进上下文。
 */
export function buildFeedbackAdjustmentInstruction(feedbackCount: number): string {
  const scope = feedbackCount > 0 ? `最近 ${Math.min(feedbackCount, 10)} 条` : '最近的'
  return `请参考上下文中学员${scope}训练反馈，适当调整训练计划中的动作、组数、次数或重量，使计划更适合学员当前状态。反馈涉及疼痛或伤病时，不要加量，并在说明里提醒我确认。`
}
