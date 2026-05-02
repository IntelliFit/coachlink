import { useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { ScenarioNutIcon } from '@/components/ScenarioNutIcon'
import { SCENARIO_QUICK_FIXES } from '@/constants/scenarioQuickFixes'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  getToolboxShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'

const TOOLBOX_LINKS = [
  {
    key: 'strength-calculator',
    label: '力量计算器',
    description: '小程序内完整实现，与网页端逻辑一致。',
    image: '/me/assets/images/toolbox-calculator.jpg',
    url: '/streetlifting/index/calculator'
  },
  {
    key: 'bar-locations',
    label: '单杠位置',
    description: '查找、分享单杠位置，支持上传图片。',
    image: '/me/assets/images/toolbox-locations.jpg',
    url: '/streetlifting/index/locations'
  },
  {
    key: 'community-data',
    label: '社区数据',
    description: '查看与提交街健力量数据，支持认领。',
    image: '/me/assets/images/toolbox-data.jpg',
    url: '/streetlifting/index/data'
  }
]

function ToolboxPage() {
  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: getToolboxShareTitle(),
        path: buildSharePath('/me/toolbox/index')
      }),
    []
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  const handleToolClick = (tool: typeof TOOLBOX_LINKS[0]) => {
    Taro.navigateTo({ url: tool.url })
  }

  const handleScenarioClick = (slug: string) => {
    Taro.navigateTo({ url: `/me/toolbox/scenario/index?slug=${slug}` })
  }

  return (
    <View className='toolbox-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='tools-grid'>
            {TOOLBOX_LINKS.map((tool) => (
              <View
                key={tool.key}
                className='tool-card'
                onClick={() => handleToolClick(tool)}
              >
                <Image
                  className='tool-bg-image'
                  src={tool.image}
                  mode='aspectFill'
                  style={{ width: '100%', height: '100%', borderRadius: '32rpx' }}
                />
                <View className='tool-gradient' />
                <View className='tool-content'>
                  <View className='tool-top-row'>
                    <Text className='tool-name'>{tool.label}</Text>
                    <Text className='iconfont icon-right-arrow tool-arrow' />
                  </View>
                  <Text className='tool-desc'>{tool.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className='scene-section'>
            <View className='scene-header'>
              <Text className='scene-title'>场景放松</Text>
              <Text className='scene-subtitle'>不用先懂体系，直接按情境开始。</Text>
            </View>
            <View className='scene-grid'>
              {SCENARIO_QUICK_FIXES.map((scenario) => (
                <View
                  key={scenario.slug}
                  className='scene-card'
                  onClick={() => handleScenarioClick(scenario.slug)}
                >
                  <Image className='scene-cover' src={scenario.coverImageUrl} mode='aspectFill' />
                  <View className='scene-icon-wrap'>
                    <ScenarioNutIcon name={scenario.icon} size={20} />
                  </View>
                  <Text className='scene-name'>{scenario.title}</Text>
                  <Text className='scene-desc'>{scenario.description}</Text>
                  <Text className='scene-meta'>约 {scenario.durationMinutes} 分钟</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default ToolboxPage
