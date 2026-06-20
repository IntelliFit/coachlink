import React, { createContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { applyThemeNativeUi, THEME_NATIVE_UI_CHANGED_EVENT } from '@/utils/themeNativeUi'

export type ThemeMode = 'light' | 'dark' | 'system' | 'auto'
export type EffectiveTheme = 'light' | 'dark'

interface ThemeContextValue {
  themeMode: ThemeMode
  effectiveTheme: EffectiveTheme
  isDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const STORAGE_KEY = 'app-theme-mode'

export const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'light',
  effectiveTheme: 'light',
  isDark: false,
  setThemeMode: () => {},
  toggleTheme: () => {},
})

/** 根据时间判断自动主题：6:00-18:00 亮色，其余暗色 */
function getAutoTheme(): EffectiveTheme {
  const hour = new Date().getHours()
  return hour >= 6 && hour < 18 ? 'light' : 'dark'
}

/** 获取系统主题 */
function getSystemTheme(): EffectiveTheme {
  try {
    const info = Taro.getSystemInfoSync()
    return info.theme === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** 根据 mode 计算 effectiveTheme */
function computeEffectiveTheme(mode: ThemeMode): EffectiveTheme {
  switch (mode) {
    case 'light':
      return 'light'
    case 'dark':
      return 'dark'
    case 'system':
      return getSystemTheme()
    case 'auto':
      return getAutoTheme()
    default:
      return 'light'
  }
}

function getSavedMode(): ThemeMode {
  try {
    const saved = Taro.getStorageSync<ThemeMode>(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system' || saved === 'auto') {
      return saved
    }
  } catch {
    // ignore
  }
  return 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getSavedMode())
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() => {
    const savedMode = getSavedMode()
    const savedEffectiveTheme = computeEffectiveTheme(savedMode)
    applyThemeNativeUi(savedEffectiveTheme)
    return savedEffectiveTheme
  })
  const systemListenerRef = useRef<any>(null)
  const autoTimerRef = useRef<any>(null)

  useEffect(() => {
    const savedMode = getSavedMode()
    const savedEffectiveTheme = computeEffectiveTheme(savedMode)
    setThemeModeState(savedMode)
    setEffectiveTheme(savedEffectiveTheme)
    applyThemeNativeUi(savedEffectiveTheme)
  }, [])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    const nextEffectiveTheme = computeEffectiveTheme(mode)
    setThemeModeState(mode)
    try {
      Taro.setStorageSync(STORAGE_KEY, mode)
    } catch {
      // ignore
    }
    setEffectiveTheme(nextEffectiveTheme)
    applyThemeNativeUi(nextEffectiveTheme)
    try {
      Taro.eventCenter.trigger(THEME_NATIVE_UI_CHANGED_EVENT, { theme: nextEffectiveTheme, mode })
    } catch {
      // ignore
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const nextMode = effectiveTheme === 'light' ? 'dark' : 'light'
    setThemeMode(nextMode)
  }, [effectiveTheme, setThemeMode])

  // system 模式：监听系统主题变化
  useEffect(() => {
    // 清理旧的监听
    if (systemListenerRef.current) {
      try {
        Taro.offThemeChange?.(systemListenerRef.current)
      } catch {
        // ignore
      }
      systemListenerRef.current = null
    }

    if (themeMode === 'system') {
      const handler = (res: any) => {
        const nextEffectiveTheme = res.theme === 'dark' ? 'dark' : 'light'
        setEffectiveTheme(nextEffectiveTheme)
        applyThemeNativeUi(nextEffectiveTheme)
      }
      try {
        Taro.onThemeChange?.(handler)
        systemListenerRef.current = handler
      } catch {
        // ignore
      }
    }

    return () => {
      if (systemListenerRef.current) {
        try {
          Taro.offThemeChange?.(systemListenerRef.current)
        } catch {
          // ignore
        }
        systemListenerRef.current = null
      }
    }
  }, [themeMode])

  // auto 模式：每分钟检查一次时间变化
  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }

    if (themeMode === 'auto') {
      autoTimerRef.current = setInterval(() => {
        const nextEffectiveTheme = getAutoTheme()
        setEffectiveTheme(nextEffectiveTheme)
        applyThemeNativeUi(nextEffectiveTheme)
      }, 60000) // 每分钟检查
    }

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [themeMode])

  // 当 effectiveTheme 变化时，同步到 app-root class 与微信原生导航栏
  useEffect(() => {
    try {
      const pages = Taro.getCurrentPages()
      pages.forEach((p: any) => {
        if (p?.setData) {
          p.setData({ __theme: effectiveTheme })
        }
      })
    } catch {
      // ignore
    }

    const syncNativeUI = () => {
      applyThemeNativeUi(effectiveTheme)
    }
    syncNativeUI()

    // 每次 App 显示或页面切换时重新同步，防止页面 config 覆盖
    let appShowHandler: any
    try {
      appShowHandler = () => {
        syncNativeUI()
      }
      Taro.onAppShow?.(appShowHandler)
    } catch {
      // ignore
    }

    return () => {
      try {
        if (appShowHandler) {
          Taro.offAppShow?.(appShowHandler)
        }
      } catch {
        // ignore
      }
    }
  }, [effectiveTheme])

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        effectiveTheme,
        isDark: effectiveTheme === 'dark',
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
