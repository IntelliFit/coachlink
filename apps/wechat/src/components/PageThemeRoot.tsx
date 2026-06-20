import { View } from '@tarojs/components'
import React, { type PropsWithChildren } from 'react'
import { useTheme } from '@/hooks/useTheme'

/**
 * 页面级主题壳：铺满视口，深色下提供底衬；浅色不额外盖色（沿用各页原背景）。
 * 参考 food_link 项目的 FlPageThemeRoot 实现。
 */
export function PageThemeRoot({ children }: PropsWithChildren): React.ReactElement {
  const { effectiveTheme } = useTheme()
  const dark = effectiveTheme === 'dark'
  return (
    <View
      className={`page-theme-root${dark ? ' page-theme-root--dark' : ''}`}
      style={{ minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}
    >
      {children}
    </View>
  )
}
