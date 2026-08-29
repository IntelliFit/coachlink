import Taro from '@tarojs/taro'

export type MiniProgramEnvVersion = 'develop' | 'trial' | 'release'

function readInjectedString(getter: () => string, fallback = ''): string {
  try {
    const value = getter()
    return typeof value === 'string' ? value.trim() : fallback
  } catch {
    return fallback
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function isSafeProductionOverride(url: string): boolean {
  const normalized = normalizeBaseUrl(url.trim())
  if (!/^https:\/\//i.test(normalized)) return false
  return !/^https:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::|\/|$)/i.test(normalized)
}

export function readMiniProgramEnvVersion(): MiniProgramEnvVersion | undefined {
  try {
    const envVersion = Taro.getAccountInfoSync?.()?.miniProgram?.envVersion
    if (envVersion === 'develop' || envVersion === 'trial' || envVersion === 'release') {
      return envVersion
    }
  } catch {
    // 非微信小程序运行时（测试、构建分析等）使用下方安全回退。
  }
  return undefined
}

/**
 * 一个上传包按微信运行环境选择 API：
 * - trial（体验版） -> dev API
 * - release（正式版） -> production API
 * - production 构建在审核阶段可能显示 develop，此时必须使用 production API
 */
export function resolveApiBaseUrl(): string {
  const isProductionBuild = !__DEV_MODE__
  const override = readInjectedString(() => __API_BASE_URL_OVERRIDE__)
  if (override && (!isProductionBuild || isSafeProductionOverride(override))) {
    return normalizeBaseUrl(override)
  }

  const releaseUrl = readInjectedString(() => __API_BASE_URL_RELEASE__)
  const trialUrl = readInjectedString(() => __API_BASE_URL_TRIAL__)
  const developUrl = readInjectedString(() => __API_BASE_URL_DEVELOP__)
  const envVersion = readMiniProgramEnvVersion()

  if (envVersion === 'release' && releaseUrl) return normalizeBaseUrl(releaseUrl)
  if (envVersion === 'trial' && trialUrl) return normalizeBaseUrl(trialUrl)
  if (envVersion === 'develop') {
    if (isProductionBuild) {
      if (releaseUrl) return normalizeBaseUrl(releaseUrl)
      if (trialUrl) return normalizeBaseUrl(trialUrl)
    } else if (developUrl) {
      return normalizeBaseUrl(developUrl)
    }
  }

  if (isProductionBuild && releaseUrl) return normalizeBaseUrl(releaseUrl)
  if (!isProductionBuild && developUrl) return normalizeBaseUrl(developUrl)
  if (trialUrl) return normalizeBaseUrl(trialUrl)
  if (releaseUrl) return normalizeBaseUrl(releaseUrl)
  if (developUrl) return normalizeBaseUrl(developUrl)
  return ''
}
