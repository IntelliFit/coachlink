export type CoachApplicationStatus =
  | 'none'
  | 'draft'
  | 'pending'
  | 'reviewing'
  | 'needs_info'
  | 'rejected'
  | 'approved'
  | 'coach'

export type CoachApplicationTone = 'slate' | 'amber' | 'orange' | 'red' | 'green'

export const COACH_TRACK_OPTIONS = [
  {
    value: 'buddy',
    label: '训练搭子',
    description: '适合帮助小白跨过入门焦虑，熟悉器械、环境和基础动作。'
  },
  {
    value: 'growth',
    label: '进阶教练',
    description: '适合已有一定经验的训练者，提供计划调整、动作修正和持续陪练。'
  },
  {
    value: 'professional',
    label: '专业教练',
    description: '适合做系统周期化训练、高阶专项、竞技表现和高客单服务。'
  }
] as const

export const SERVICE_MODE_OPTIONS = [
  { value: 'online', label: '线上指导' },
  { value: 'offline', label: '线下带练' }
] as const

export const TARGET_STUDENT_LEVEL_OPTIONS = [
  { value: 'beginner', label: '小白入门' },
  { value: 'intermediate', label: '进阶提升' },
  { value: 'advanced', label: '高阶表现' }
] as const

export function normalizeCoachApplicationStatus(status: unknown, isCoach?: boolean): CoachApplicationStatus {
  if (isCoach) return 'coach'
  switch (status) {
    case 'draft':
    case 'pending':
    case 'reviewing':
    case 'needs_info':
    case 'rejected':
    case 'approved':
      return status
    default:
      return 'none'
  }
}

export function getCoachTrackLabel(value: string | null | undefined) {
  return COACH_TRACK_OPTIONS.find((item) => item.value === value)?.label || '未分层'
}

export function getServiceModeLabel(value: string | null | undefined) {
  return SERVICE_MODE_OPTIONS.find((item) => item.value === value)?.label || value || '未知'
}

export function getTargetStudentLevelLabel(value: string | null | undefined) {
  return TARGET_STUDENT_LEVEL_OPTIONS.find((item) => item.value === value)?.label || value || '未知'
}

export function getCoachApplicationStatusMeta(
  status: CoachApplicationStatus,
  reviewNotes?: string | null,
) {
  switch (status) {
    case 'coach':
      return {
        label: '已获得教练权限',
        tone: 'green' as CoachApplicationTone,
        actionLabel: '切换到教练端',
        menuLabel: '切换到教练端',
        hint: '恭喜，你已经获得教练权限，现在可以切换到教练端继续完善主页和业务配置。'
      }
    case 'approved':
      return {
        label: '已通过',
        tone: 'green' as CoachApplicationTone,
        actionLabel: '切换到教练端',
        menuLabel: '进入教练端',
        hint: '你的教练申请已经通过，建议尽快切换到教练端完成定价、问卷和主页资料配置。'
      }
    case 'reviewing':
      return {
        label: '审核中',
        tone: 'amber' as CoachApplicationTone,
        actionLabel: '查看申请详情',
        menuLabel: '教练申请进度',
        hint: '平台正在复核你的申请资料，期间你仍然可以进入申请页查看当前状态。'
      }
    case 'pending':
      return {
        label: '审核中',
        tone: 'amber' as CoachApplicationTone,
        actionLabel: '查看申请详情',
        menuLabel: '教练申请进度',
        hint: '教练团队正在审核你的资料，通常会在 2 个工作日内给出结果。'
      }
    case 'needs_info':
      return {
        label: '待补充材料',
        tone: 'orange' as CoachApplicationTone,
        actionLabel: '去补充资料',
        menuLabel: '补充申请资料',
        hint: reviewNotes
          ? `审核团队反馈：${reviewNotes}`
          : '请根据审核意见补充资料后重新提交。'
      }
    case 'rejected':
      return {
        label: '已驳回',
        tone: 'red' as CoachApplicationTone,
        actionLabel: '重新提交申请',
        menuLabel: '重新提交申请',
        hint: reviewNotes
          ? `驳回原因：${reviewNotes}。请修改后重新提交。`
          : '申请暂未通过，请根据提示修改后再次提交。'
      }
    case 'draft':
      return {
        label: '草稿未提交',
        tone: 'slate' as CoachApplicationTone,
        actionLabel: '继续填写申请',
        menuLabel: '继续填写申请',
        hint: '你已经保存了申请草稿，继续完善后提交即可进入审核流程。'
      }
    case 'none':
    default:
      return {
        label: '未申请',
        tone: 'slate' as CoachApplicationTone,
        actionLabel: '申请成为教练',
        menuLabel: '申请成为教练',
        hint: '完成教练申请并审核通过后，你就可以切换到教练端管理主页、问卷和学员。'
      }
  }
}
