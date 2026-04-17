import React, { useEffect } from 'react'
import { useDidShow, useDidHide } from '@tarojs/taro'
import { authService } from '@/services/authService'
// 全局样式
import './app.scss'

function App(props) {
  // 可以使用所有的 React Hooks
  useEffect(() => {
    authService.normalizeAuthSession()
  }, [])

  // 对应 onShow
  useDidShow(() => {
    authService.normalizeAuthSession()
  })

  // 对应 onHide
  useDidHide(() => {})

  return props.children
}

export default App
