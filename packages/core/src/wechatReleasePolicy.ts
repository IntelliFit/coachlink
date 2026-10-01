/** Release policy, not a remote feature flag. Change only with a new reviewed release. */
export const WECHAT_FREE_RELEASE: boolean = true
export const WECHAT_FREE_RELEASE_HEADER = 'x-coachlink-release'
export const WECHAT_FREE_RELEASE_ID = 'wechat-free-v1'
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
