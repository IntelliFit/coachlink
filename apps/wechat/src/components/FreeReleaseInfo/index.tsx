import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTheme } from '@/hooks/useTheme'
import './index.scss'

export default function FreeReleaseInfo({ title, description }: { title: string; description: string }) {
  const { effectiveTheme } = useTheme()
  return (
    <View className={`free-release-page theme-${effectiveTheme}`}>
      <View className='free-release-card'>
        <Text className='free-release-title'>{title}</Text>
        <Text className='free-release-copy'>{description}</Text>
        <View className='free-release-button' onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
          <Text>返回训练首页</Text>
        </View>
      </View>
    </View>
  )
}
