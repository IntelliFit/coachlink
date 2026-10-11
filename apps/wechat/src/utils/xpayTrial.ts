import Taro from '@tarojs/taro'

export function isXPayTrialClient() {
  try {
    const version = Taro.getAccountInfoSync().miniProgram.envVersion
    return version === 'trial' || version === 'develop'
  } catch { return false }
}
