import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

/**
 * 小程序快捷登录统一入口。小程序内登录/绑定已在登录页完成；
 * login-bridge/bridge/bind/bind-bridge 为网页端用，此处仅做说明或重定向。
 */
export default function WechatAuth() {
  React.useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const type = (params.type || params.t) as string
    if (type === 'bind') {
      Taro.redirectTo({ url: '/auth/login?action=bind' })
      return
    }
    if (type === 'login') {
      Taro.redirectTo({ url: '/auth/login' })
      return
    }
  }, [])

  return (
    <View className="wechat-auth-page">
      <View className="card">
        <Text className="title">快捷登录</Text>
        <Text className="desc">您已在小程序内，请直接使用首页或「我的」中的登录/绑定功能。</Text>
        <View className="btn" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
          <Text>去首页</Text>
        </View>
      </View>
    </View>
  )
}
