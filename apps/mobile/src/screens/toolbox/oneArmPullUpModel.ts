export type OneArmPullUpReadinessLevel = {
  name: string
  summary: string
  focus: string
  tone: 'foundation' | 'strength' | 'bridge' | 'specific' | 'ready'
  unilateralExercise: string
}

export const ONE_ARM_PULL_UP_LEVELS: OneArmPullUpReadinessLevel[] = [
  {
    name: '基础力量期',
    summary: '先把双手引体的动作质量和基础拉力做扎实。',
    focus: '稳定完成 8–12 次严格自重引体',
    tone: 'foundation',
    unilateralExercise: '偏重引体或弓箭手引体 4 × 4/侧',
  },
  {
    name: '负重积累期',
    summary: '你已经有不错基础，下一步是稳定提高最大拉力。',
    focus: '让负重 1RM 逐步接近 0.5 倍体重',
    tone: 'strength',
    unilateralExercise: '弓箭手引体 4 × 3/侧',
  },
  {
    name: '单侧过渡期',
    summary: '力量底子已经形成，可以增加单侧动作的比重。',
    focus: '同步提高负重力量与单侧控制',
    tone: 'bridge',
    unilateralExercise: '弹力带辅助单手引体 5 × 3/侧',
  },
  {
    name: '专项冲刺期',
    summary: '你离理论门槛已经很近，重点转向单手专项技术。',
    focus: '补齐起拉、顶端和抗旋转控制',
    tone: 'specific',
    unilateralExercise: '低辅助单手引体 + 5 秒离心 5 × 2/侧',
  },
  {
    name: '理论门槛已达到',
    summary: '你的负重力量已达到经验门槛，可以安排高质量单手尝试。',
    focus: '把双手最大力量转化为单手动作能力',
    tone: 'ready',
    unilateralExercise: '标准单手引体尝试 4–6 次/侧，次间充分休息',
  },
]

export function getOneArmPullUpReadinessLevel(additionalRatio: number) {
  if (additionalRatio >= 0.8) return ONE_ARM_PULL_UP_LEVELS[4]
  if (additionalRatio >= 0.68) return ONE_ARM_PULL_UP_LEVELS[3]
  if (additionalRatio >= 0.48) return ONE_ARM_PULL_UP_LEVELS[2]
  if (additionalRatio >= 0.25) return ONE_ARM_PULL_UP_LEVELS[1]
  return ONE_ARM_PULL_UP_LEVELS[0]
}

export function calculateOneArmPullUpReadiness(
  bodyWeight: number,
  additionalWeight: number,
) {
  if (
    !Number.isFinite(bodyWeight) ||
    bodyWeight <= 0 ||
    !Number.isFinite(additionalWeight) ||
    additionalWeight < 0
  ) {
    return null
  }

  const targetAdditionalWeight = bodyWeight * 0.8
  const additionalRatio = additionalWeight / bodyWeight
  const progress = (additionalWeight / targetAdditionalWeight) * 100
  const equivalentBodyWeight = (bodyWeight + additionalWeight) / 1.8

  return {
    targetAdditionalWeight,
    additionalRatio,
    systemRatio: (bodyWeight + additionalWeight) / bodyWeight,
    progress,
    progressWidth: Math.min(100, Math.max(0, progress)),
    gap: Math.max(0, targetAdditionalWeight - additionalWeight),
    equivalentBodyWeight,
    equivalentDelta: equivalentBodyWeight - bodyWeight,
    level: getOneArmPullUpReadinessLevel(additionalRatio),
  }
}

export function formatAssessmentKg(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, '')} kg`
}
