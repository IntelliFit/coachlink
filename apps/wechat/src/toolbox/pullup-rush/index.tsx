import { useEffect } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'

/** 引体冲刺已合并进快乐小鸟。页面保留给旧的分享链接和榜单入口，打开后直接跳转。 */
export default function PullupRushRedirectPage() {
  useEffect(() => {
    void Taro.redirectTo({ url: '/toolbox/happy-bird/index' })
  }, [])

  return <View />
}
