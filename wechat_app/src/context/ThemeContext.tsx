import React, { createContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import Taro from '@tarojs/taro'

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
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getSavedMode)
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() =>
    computeEffectiveTheme(getSavedMode())
  )
  const systemListenerRef = useRef<any>(null)
  const autoTimerRef = useRef<any>(null)

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
    try {
      Taro.setStorageSync(STORAGE_KEY, mode)
    } catch {
      // ignore
    }
    setEffectiveTheme(computeEffectiveTheme(mode))
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
        setEffectiveTheme(res.theme === 'dark' ? 'dark' : 'light')
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
        setEffectiveTheme(getAutoTheme())
      }, 60000) // 每分钟检查
    }

    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [themeMode])

  // 当 effectiveTheme 变化时，同步到 app-root class
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
