import { useEffect } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTheme } from '@/hooks/useTheme'
import './index.scss'

/**
 * 兼容旧入口和历史分享路径。
 * 即兴训练的动作选择已统一到学员动作库，避免在此再维护一套搜索、筛选和列表。
 */
export default function ImpromptuTrainingRedirect() {
  const { effectiveTheme } = useTheme()

  useEffect(() => {
    void Taro.redirectTo({
      url: '/me/action-lib/index?mode=impromptu-select&source=frequent&itemType=STRENGTH'
    })
  }, [])

  return (
    <View className={`impromptu-training-redirect theme-${effectiveTheme}`}>
      <Text>正在进入动作库...</Text>
    </View>
  )
}
