/**
 * 教练入驻政策：Web、小程序、APP 申请页、审核私信和《教练手册》共用同一份口径；
 * 平台分账也从这里取比例，改这里就是改线上抽成。
 */

/** 平台服务费：入驻初期 / 优惠期统一 10%（2026-10-22 平台负责人确定）。 */
export const PLATFORM_COMMISSION_PERCENT = 10

export const COACH_HANDBOOK_PATH = '/coach/handbook'

/**
 * 教练群二维码，放在 Web 的 public/images 下随版本发布。微信群码 7 天过期，
 * 换码时覆盖同名文件并更新有效期后重新发布即可。
 */
export const COACH_GROUP_QR_PATH = '/images/coach-wechat-group.png'
export const COACH_GROUP_QR_VALID_UNTIL = '2026-10-30'

/** 申请页「入驻须知」要点，提交前需勾选同意。 */
export const COACH_APPLICATION_POLICY_POINTS: readonly string[] = [
  `平台服务费：入驻初期按订单金额的 ${PLATFORM_COMMISSION_PERCENT}% 收取，其余归教练，可在教练端申请提现。`,
  '资质与经历如实填写，平台审核时会电话或微信联系你核实。',
  '学员交易在平台内完成，不引导站外付款，平台才能保障双方权益。',
  '不做医疗诊断、不推荐违禁药物、不承诺具体效果，学员有伤病先建议就医。',
  '保护学员隐私，不外传学员资料和训练视频。',
]

export const COACH_APPLICATION_POLICY_CONSENT = '我已阅读并同意以上入驻须知和《教练手册》中的服务规范'

/** 大陆 11 位手机号，或带 + 的国际号码（7-15 位数字）。允许中间有空格和短横线。 */
export function isValidCoachContactPhone(value: string | null | undefined): boolean {
  const compact = String(value ?? '').replace(/[\s-]/g, '')
  if (/^1\d{10}$/.test(compact)) return true
  return /^\+\d{7,15}$/.test(compact)
}
