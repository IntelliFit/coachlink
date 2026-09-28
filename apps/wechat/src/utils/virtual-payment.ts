export interface VirtualPaymentRequestOptions {
  signData: string
  paySig: string
  signature: string
  mode: 'short_series_goods'
}

interface VirtualPaymentCallbackOptions extends VirtualPaymentRequestOptions {
  success: (result: unknown) => void
  fail: (error: unknown) => void
}

type VirtualPaymentInvoker = (options: VirtualPaymentCallbackOptions) => unknown

/** 微信虚拟支付依赖原生回调，当前 Taro 声明不能当作 Promise 直接等待。 */
export function requestVirtualPaymentAndWait(
  invoker: unknown,
  options: VirtualPaymentRequestOptions,
): Promise<unknown> {
  if (typeof invoker !== 'function') {
    return Promise.reject(new Error('当前微信版本暂不支持虚拟支付，请升级微信后重试'))
  }

  const invoke = invoker as VirtualPaymentInvoker
  return new Promise((resolve, reject) => {
    try {
      invoke({ ...options, success: resolve, fail: reject })
    } catch (error) {
      reject(error)
    }
  })
}

export function isVirtualPaymentCancellation(error: unknown): boolean {
  const candidate = error as { errCode?: unknown; errno?: unknown; errMsg?: unknown; message?: unknown } | null
  const errorCode = Number(candidate?.errCode ?? candidate?.errno ?? 0)
  const message = String(candidate?.errMsg ?? candidate?.message ?? '')
  return errorCode === -2 || /cancel|取消/i.test(message)
}

export function virtualPaymentErrorMessage(error: unknown): string {
  const candidate = error as { errCode?: unknown; errno?: unknown; errMsg?: unknown; message?: unknown } | null
  const errorCode = Number(candidate?.errCode ?? candidate?.errno ?? 0)
  if (errorCode === -15010) return '该价格商品正在同步微信，请稍后再试'
  if (errorCode === -15013) return '商品价格与微信商品目录不一致，请联系平台处理'
  if (errorCode === -15014) return '该商品尚未生效，请稍后再试'
  return String(candidate?.errMsg ?? candidate?.message ?? '')
}
