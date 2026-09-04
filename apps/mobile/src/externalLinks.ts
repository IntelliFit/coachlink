import { Alert, Linking } from 'react-native'

type OpenExternalUrlOptions = {
  errorTitle?: string
  errorMessage?: string
}

export async function openExternalUrl(
  url?: string | null,
  options: OpenExternalUrlOptions = {},
) {
  const target = String(url || '').trim()
  if (!target) {
    Alert.alert(options.errorTitle || '无法打开', options.errorMessage || '链接不存在，请稍后重试。')
    return false
  }

  try {
    if (!(await Linking.canOpenURL(target))) throw new Error('unsupported url')
    await Linking.openURL(target)
    return true
  } catch {
    Alert.alert(options.errorTitle || '无法打开', options.errorMessage || '系统无法打开该链接，请稍后重试。')
    return false
  }
}
