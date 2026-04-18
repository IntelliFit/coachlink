import React, { useEffect, useContext } from 'react'
import { View } from '@tarojs/components'
import { useDidShow, useDidHide } from '@tarojs/taro'
import { authService } from '@/services/authService'
import { ThemeProvider, ThemeContext } from '@/context/ThemeContext'
// 全局样式
import './app.scss'
import './assets/iconfont/iconfont.css'

function AppContent(props: { children: React.ReactNode }) {
  const { effectiveTheme } = useContext(ThemeContext)

  useEffect(() => {
    authService.normalizeAuthSession()
  }, [])

  useDidShow(() => {
    authService.normalizeAuthSession()
  })

  useDidHide(() => {})

  return React.createElement(
    View,
    { className: `app-root theme-${effectiveTheme}`, style: { minHeight: '100vh' } },
    props.children
  )
}

function App(props: { children: React.ReactNode }) {
  return React.createElement(
    ThemeProvider,
    null,
    React.createElement(AppContent, null, props.children)
  )
}

export default App
