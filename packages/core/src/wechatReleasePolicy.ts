/** Mini-program policy is compiled into its package; API opt-in alone cannot
 * turn old free packages into paid packages (their free marker stays blocked). */
export const WECHAT_FREE_RELEASE: boolean = process.env.COACHLINK_WECHAT_PAID_RELEASE !== 'true'
export const WECHAT_FREE_RELEASE_HEADER = 'x-coachlink-release'
export const WECHAT_FREE_RELEASE_ID = 'wechat-free-v1'
// Coach services use Huifu independently of free platform membership.
// Compiled release capabilities, never authentication or remote flags.
export const WECHAT_COACH_PURCHASE_ENABLED: boolean = true
export const WECHAT_COACH_PURCHASE_PAUSED: boolean = !WECHAT_COACH_PURCHASE_ENABLED
export const WECHAT_COACH_PURCHASE_HEADER = 'x-coachlink-coach-purchase'
export const WECHAT_COACH_PURCHASE_ID = 'huifu-coach-v1'
export const WECHAT_FREE_LIMITS = {
  aiImportsMonthly: 30,
  storageMb: 1024,
  powerVideoMb: 200,
  powerDurationSeconds: 60,
  powerDaily: 20,
} as const
export const WECHAT_PURCHASE_PAUSED_MESSAGE = '免费版暂不提供购买或续费，已有权益不受影响'

export function isWechatNewPurchasePath(path: string) {
  return [
    /^\/api\/payment\/(?:wechat\/(?:membership|coach|test)|alipay(?:\/guest)?)\/create$/,
    /^\/api\/membership\/create-order$/,
    /^\/api\/subscription\/(?:create-subscription|renew-subscription)$/,
    /^\/api\/cart\/add$/,
    /^\/api\/knowledge\/subscription$/,
    /^\/api\/toolbox\/motion-effects\/create-upload-url$/,
    /^\/api\/toolbox\/motion-effects\/jobs\/[^/]+\/order$/,
  ].some(pattern => pattern.test(path.split('?')[0]))
}

export function wechatReleaseHeaders(): Record<string, string> {
  return WECHAT_FREE_RELEASE
    ? { [WECHAT_FREE_RELEASE_HEADER]: WECHAT_FREE_RELEASE_ID }
    : {}
}

export function isWechatCoachPurchasePath(path: string) {
  // Renewal is a Huifu coach order with renew=true, not a direct entitlement grant.
  return [
    /^\/api\/payment\/wechat\/coach\/create$/,
    /^\/api\/subscription\/create-subscription$/,
    /^\/api\/cart\/add$/,
  ].some(pattern => pattern.test(path.split('?')[0]))
}

export function isWechatPurchasePaused(path: string) {
  return WECHAT_FREE_RELEASE && isWechatNewPurchasePath(path)
    && !(WECHAT_COACH_PURCHASE_ENABLED && isWechatCoachPurchasePath(path))
}

export function wechatCoachPurchaseHeaders(): Record<string, string> {
  return WECHAT_COACH_PURCHASE_ENABLED
    ? { [WECHAT_COACH_PURCHASE_HEADER]: WECHAT_COACH_PURCHASE_ID }
    : {}
}
