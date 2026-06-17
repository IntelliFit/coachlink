import Taro from '@tarojs/taro'

export type NativeTheme = 'light' | 'dark'

interface ThemeNativeUiOptions {
  lightBackground?: string
  darkBackground?: string
}

export const THEME_NATIVE_UI_CHANGED_EVENT = 'coachlink_theme_native_ui_changed'

export function applyThemeNativeUi(theme: NativeTheme, options?: ThemeNativeUiOptions): void {
  const isDark = theme === 'dark'
  const lightBackground = options?.lightBackground || '#ffffff'
  const darkBackground = options?.darkBackground || '#181817'
  const backgroundColor = isDark ? darkBackground : lightBackground

  try {
    Taro.setNavigationBarColor({
      frontColor: isDark ? '#ffffff' : '#000000',
      backgroundColor,
      animation: {
        duration: 0,
        timingFunc: 'linear',
      },
    })
  } catch {
    // ignore native UI sync failures
  }

  try {
    ;(Taro as any).setBackgroundColor?.({
      backgroundColor,
      backgroundColorTop: backgroundColor,
      backgroundColorBottom: backgroundColor,
    })
  } catch {
    // ignore native UI sync failures
  }

  try {
    ;(Taro as any).setBackgroundTextStyle?.({
      textStyle: isDark ? 'light' : 'dark',
    })
  } catch {
    // ignore native UI sync failures
  }
}
